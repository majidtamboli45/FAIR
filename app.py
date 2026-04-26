from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import io
import os

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

from fairlearn.metrics import demographic_parity_difference
from fairlearn.reductions import ExponentiatedGradient, DemographicParity

from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

app = Flask(__name__)
CORS(app)

# ================= INSPECT =================

@app.route("/inspect", methods=["POST"])
def inspect():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"})

    df = pd.read_csv(file)

    columns = list(df.columns)

    # simple guesses
    target_candidates = [c for c in columns if df[c].nunique() == 2]
    sensitive_candidates = columns

    warnings = []
    if len(columns) < 2:
        warnings.append("Dataset too small")

    return jsonify({
        "columns": columns,
        "target_candidates": target_candidates,
        "sensitive_candidates": sensitive_candidates,
        "warnings": warnings
    })


# ================= ANALYZE =================

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        file = request.files.get("file")
        target = request.form.get("target")
        sensitive = request.form.get("sensitive")

        if not file or not target or not sensitive:
            return jsonify({"error": "Missing inputs"})

        df = pd.read_csv(file)

        if target not in df.columns:
            return jsonify({"error": "Invalid target column"})

        if sensitive not in df.columns:
            return jsonify({"error": "Invalid sensitive column"})

        if df[target].nunique() != 2:
            return jsonify({"error": "Target must be binary"})

        # ===== PREP =====
        X = pd.get_dummies(df.drop(target, axis=1))
        y = df[target]
        s = df[sensitive]

        X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
            X, y, s, test_size=0.3, random_state=42
        )

        # ===== BEFORE MODEL =====
        model = LogisticRegression(max_iter=300)
        model.fit(X_train, y_train)
        y_pred_before = model.predict(X_test)

        # ===== FAIR MODEL =====
        mitigator = ExponentiatedGradient(
            LogisticRegression(max_iter=300),
            constraints=DemographicParity()
        )

        mitigator.fit(X_train, y_train, sensitive_features=s_train)
        y_pred_after = mitigator.predict(X_test)

        # ===== METRICS =====
        bias_before = demographic_parity_difference(
            y_true=y_test,
            y_pred=y_pred_before,
            sensitive_features=s_test
        )

        bias_after = demographic_parity_difference(
            y_true=y_test,
            y_pred=y_pred_after,
            sensitive_features=s_test
        )

        fairness_before = round(100 - abs(bias_before * 100), 2)
        fairness_after = round(100 - abs(bias_after * 100), 2)

        # ===== COLUMN BIAS =====
        column_bias = {}
        for col in df.columns:
            if col == target:
                continue
            try:
                if df[col].nunique() <= 10:
                    group_means = df.groupby(col)[target].mean()
                    diff = group_means.max() - group_means.min()
                    column_bias[col] = round(diff, 3)
            except:
                pass

        most_biased = max(column_bias, key=column_bias.get) if column_bias else None

        # ===== SAVE FAIR DATASET =====
        df["prediction_before"] = 0
        df["prediction_after"] = 0

        # align sizes (simple handling)
        df.loc[X_test.index, "prediction_before"] = y_pred_before
        df.loc[X_test.index, "prediction_after"] = y_pred_after

        df.to_csv("fair_dataset.csv", index=False)

        return jsonify({
            "before_bias": round(bias_before, 3),
            "after_bias": round(bias_after, 3),
            "before_fairness": fairness_before,
            "after_fairness": fairness_after,
            "bias": round(bias_before, 3),  # for frontend compatibility
            "fairness_score": fairness_before,
            "column_bias": column_bias,
            "most_biased_column": most_biased
        })

    except Exception as e:
        return jsonify({"error": str(e)})


# ================= FIX BIAS =================

@app.route("/fix-bias", methods=["POST"])
def fix_bias():
    try:
        file = request.files.get("file")
        target = request.form.get("target")
        sensitive = request.form.get("sensitive")

        df = pd.read_csv(file)

        X = pd.get_dummies(df.drop(target, axis=1))
        y = df[target]
        s = df[sensitive]

        X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
            X, y, s, test_size=0.3, random_state=42
        )

        mitigator = ExponentiatedGradient(
            LogisticRegression(max_iter=300),
            constraints=DemographicParity()
        )

        mitigator.fit(X_train, y_train, sensitive_features=s_train)
        y_pred = mitigator.predict(X_test)

        bias = demographic_parity_difference(
            y_true=y_test,
            y_pred=y_pred,
            sensitive_features=s_test
        )

        fairness = round(100 - abs(bias * 100), 2)

        return jsonify({
            "new_bias": round(bias, 3),
            "new_fairness_score": fairness
        })

    except Exception as e:
        return jsonify({"error": str(e)})


# ================= DOWNLOAD FAIR DATA =================

@app.route("/download-fair-data", methods=["POST"])
def download_fair_data():
    try:
        return send_file(
            "fair_dataset.csv",
            as_attachment=True,
            download_name="fair_dataset.csv"
        )
    except Exception as e:
        return jsonify({"error": str(e)})


# ================= REPORT =================

@app.route("/generate-report", methods=["POST"])
def generate_report():
    try:
        data = request.json

        buffer = io.BytesIO()

        doc = SimpleDocTemplate(buffer)
        styles = getSampleStyleSheet()

        content = []

        content.append(Paragraph("FairAI Report", styles["Title"]))
        content.append(Paragraph(f"Fairness (Before): {data.get('fairness')}", styles["Normal"]))
        content.append(Paragraph(f"Bias (Before): {data.get('bias')}", styles["Normal"]))
        content.append(Paragraph(f"Most Biased Column: {data.get('most_biased')}", styles["Normal"]))

        content.append(Paragraph(f"Fairness (After): {data.get('fixed_fairness')}", styles["Normal"]))
        content.append(Paragraph(f"Bias (After): {data.get('fixed_bias')}", styles["Normal"]))

        doc.build(content)

        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name="FairAI_Report.pdf",
            mimetype="application/pdf"
        )

    except Exception as e:
        return jsonify({"error": str(e)})


# ================= RUN =================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
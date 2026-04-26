import React, { useState } from "react";
import Login from "./Login";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [darkMode, setDarkMode] = useState(true);

  const [files, setFiles] = useState([]);
  const [columns, setColumns] = useState([]);
  const [target, setTarget] = useState("");
  const [sensitive, setSensitive] = useState("");
  const [warnings, setWarnings] = useState([]);

  const [result, setResult] = useState(null);
  const [fixedResult, setFixedResult] = useState(null);

  // 🔥 IMPORTANT: CHANGE THIS TO YOUR DEPLOYED BACKEND
  const API = "http://127.0.0.1:5000";

  const token = localStorage.getItem("token");

  if (!loggedIn) return <Login setLoggedIn={setLoggedIn} />;

  const secureFetch = async (url, options) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: token,
        },
      });

      if (res.status === 401) {
        alert("Session expired");
        localStorage.removeItem("token");
        setLoggedIn(false);
        return null;
      }

      return res;
    } catch (err) {
      alert("❌ Backend not reachable");
      return null;
    }
  };

  // ================= API =================

  const handleInspect = async () => {
    if (!files[0]) return alert("Upload dataset first");

    const fd = new FormData();
    fd.append("file", files[0]);

    const res = await secureFetch(`${API}/inspect`, {
      method: "POST",
      body: fd,
    });

    if (!res) return;

    const data = await res.json();

    setColumns(data.columns || []);
    setTarget(data.target_candidates?.[0] || "");
    setSensitive(data.sensitive_candidates?.[0] || "");
    setWarnings(data.warnings || []);
  };

  const handleAnalyze = async () => {
    if (!files[0]) return alert("Upload dataset first");

    const fd = new FormData();
    fd.append("file", files[0]);
    fd.append("target", target);
    fd.append("sensitive", sensitive);

    const res = await secureFetch(`${API}/analyze`, {
      method: "POST",
      body: fd,
    });

    if (!res) return;

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    // 🔥 NEW: support both old + new backend responses
    setResult({
      ...data,
      fairness_score:
        data.fairness_score ?? data.before_fairness ?? 0,
      bias:
        data.bias ?? data.before_bias ?? 0,
    });

    setFixedResult({
      new_fairness_score:
        data.after_fairness ?? data.fairness_score,
      new_bias:
        data.after_bias ?? data.bias,
    });
  };

  const handleFix = async () => {
    const fd = new FormData();
    fd.append("file", files[0]);
    fd.append("target", target);
    fd.append("sensitive", sensitive);

    const res = await secureFetch(`${API}/fix-bias`, {
      method: "POST",
      body: fd,
    });

    if (!res) return;

    const data = await res.json();
    setFixedResult(data);
  };

  // ================= DOWNLOADS =================

  const downloadReport = async () => {
    const res = await secureFetch(`${API}/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fairness: result?.fairness_score,
        bias: result?.bias,
        most_biased: result?.most_biased_column,
        fixed_fairness: fixedResult?.new_fairness_score,
        fixed_bias: fixedResult?.new_bias,
      }),
    });

    if (!res) return;

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "FairAI_Report.pdf";
    a.click();
  };

  const downloadFair = async () => {
    const fd = new FormData();
    fd.append("file", files[0]);
    fd.append("target", target);
    fd.append("sensitive", sensitive);

    const res = await secureFetch(`${API}/download-fair-data`, {
      method: "POST",
      body: fd,
    });

    if (!res) return;

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "fair_dataset.csv";
    a.click();
  };

  // ================= AI SUGGESTION =================

  const getSuggestion = () => {
    if (!result) return "";

    if (Math.abs(result.bias) > 0.2) {
      return `⚠️ High bias detected in '${sensitive}'. Use fairness mitigation.`;
    } else if (Math.abs(result.bias) > 0.05) {
      return `⚠️ Moderate bias in '${sensitive}'. Monitor closely.`;
    } else {
      return "✅ Model looks fair.";
    }
  };

  // ================= CHART =================

  const chartData = result && {
    labels: ["Before", "After"],
    datasets: [
      {
        label: "Fairness",
        data: [
          result.fairness_score,
          fixedResult?.new_fairness_score ?? result.fairness_score,
        ],
        backgroundColor: "#00ffc6",
      },
      {
        label: "Bias",
        data: [
          Math.abs(result.bias * 100),
          Math.abs(
            (fixedResult?.new_bias ?? result.bias) * 100
          ),
        ],
        backgroundColor: "#ff4d6d",
      },
    ],
  };

  // ================= UI =================

  const theme = {
    background: darkMode
      ? "linear-gradient(135deg,#000000,#1c1c1c)"
      : "linear-gradient(135deg,#ff9a9e,#fad0c4)",
    color: darkMode ? "white" : "black",
  };

  return (
    <div style={{ minHeight: "100vh", ...theme, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>

        <button
          onClick={() => {
            localStorage.removeItem("token");
            setLoggedIn(false);
          }}
        >
          Logout
        </button>
      </div>

      <h1>🎬 FairAI Premium Dashboard</h1>

      <div style={card}>
        <input type="file" onChange={(e) => setFiles(e.target.files)} />
        <button style={btn} onClick={handleInspect}>
          Inspect
        </button>
      </div>

      {warnings.map((w, i) => (
        <p key={i} style={{ color: "red" }}>
          {w}
        </p>
      ))}

      {columns.length > 0 && (
        <div style={card}>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <select
            value={sensitive}
            onChange={(e) => setSensitive(e.target.value)}
          >
            {columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <button style={btn} onClick={handleAnalyze}>
            Analyze
          </button>
        </div>
      )}

      {result && (
        <div style={card}>
          <h3>Fairness: {result.fairness_score}</h3>
          <h3>Bias: {result.bias}</h3>
          <p>🚨 Most Biased: {result.most_biased_column}</p>

          <div style={aiBox}>🧠 {getSuggestion()}</div>

          <button style={btn} onClick={handleFix}>
            Fix Bias
          </button>
          <button style={btn} onClick={downloadReport}>
            Download Report
          </button>
          <button style={btn} onClick={downloadFair}>
            Download Fair Dataset
          </button>
        </div>
      )}

      {fixedResult && (
        <div style={card}>
          <h3>After Fix</h3>
          <p>Fairness: {fixedResult.new_fairness_score}</p>
          <p>Bias: {fixedResult.new_bias}</p>
        </div>
      )}

      {chartData && (
        <div style={card}>
          <Bar data={chartData} />
        </div>
      )}
    </div>
  );
}

// ================= STYLES =================

const card = {
  background: "rgba(255,255,255,0.08)",
  padding: "20px",
  borderRadius: "15px",
  margin: "20px auto",
  width: "70%",
  backdropFilter: "blur(10px)",
};

const btn = {
  padding: "10px 20px",
  margin: "10px",
  borderRadius: "8px",
  border: "none",
  background: "linear-gradient(45deg,#ff416c,#ff4b2b)",
  color: "white",
  cursor: "pointer",
};

const aiBox = {
  marginTop: "15px",
  padding: "10px",
  background: "#111",
  borderLeft: "4px solid #00ffc6",
};

export default App;
import React, { useState } from "react";

function Login({ setLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const handleLogin = async () => {
    setError("");

    if (!username || !password) {
      setError("⚠️ Please enter username and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.status === 200 && data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("loginTime", new Date().toISOString());
        setLoggedIn(true);
      } else {
        setError("❌ Invalid credentials");
      }
    } catch {
      setError("⚠️ Cannot connect to server");
    }

    setLoading(false);
  };

  // ================= THEME =================

  const theme = {
    background: darkMode
      ? "linear-gradient(135deg,#000000,#1c1c1c)"
      : "linear-gradient(135deg,#ff9a9e,#fad0c4)",
    color: darkMode ? "white" : "black"
  };

  return (
    <div style={{ ...container, ...theme }}>

      {/* TOGGLE */}
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <button style={toggleBtn} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* LOGIN CARD */}
      <div style={card}>
        <h1 style={{ marginBottom: "10px" }}>🎬 FairAI</h1>
        <h3 style={{ marginBottom: "20px", opacity: 0.8 }}>
          AI Fairness Dashboard
        </h3>

        <input
          style={input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <div style={{ position: "relative" }}>
          <input
            style={input}
            type={showPass ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <span style={eye} onClick={() => setShowPass(!showPass)}>
            {showPass ? "🙈" : "👁️"}
          </span>
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <button
          style={{
            ...btn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer"
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={{ marginTop: "15px", fontSize: "13px", opacity: 0.7 }}>
          Demo: admin / 1234
        </p>
      </div>
    </div>
  );
}

export default Login;

/////////////////////// STYLES ///////////////////////

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative"
};

const card = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(15px)",
  padding: "40px",
  borderRadius: "20px",
  width: "340px",
  textAlign: "center",
  boxShadow: "0 8px 40px rgba(0,0,0,0.6)"
};

const input = {
  width: "100%",
  padding: "12px",
  margin: "10px 0",
  borderRadius: "8px",
  border: "none",
  outline: "none",
  fontSize: "14px",
  background: "rgba(255,255,255,0.1)",
  color: "white"
};

const btn = {
  width: "100%",
  padding: "12px",
  marginTop: "15px",
  borderRadius: "8px",
  border: "none",
  background: "linear-gradient(45deg,#ff416c,#ff4b2b)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const toggleBtn = {
  padding: "8px 15px",
  borderRadius: "8px",
  border: "none",
  background: "#222",
  color: "white",
  cursor: "pointer"
};

const errorStyle = {
  color: "#ff4d6d",
  fontSize: "14px"
};

const eye = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  cursor: "pointer"
};
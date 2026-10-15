import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      alert("Local cache cleared. Reloading...");
      window.location.href = "/";
    } catch (e) {
      console.error("Cache clear failed:", e);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "24px 16px",
            background: "#090d16",
            color: "#f8fafc",
            fontFamily: "system-ui, -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#131b2e",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "12px"
              }}
            >
              NutriTrack Diagnostic
            </div>

            <h1 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px 0" }}>
              Application Startup Issue Detected
            </h1>

            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              NutriTrack prevented a blank white screen by catching this runtime exception:
            </p>

            <pre
              style={{
                background: "#060911",
                padding: "12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fca5a5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: "160px",
                overflowY: "auto",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "20px"
              }}
            >
              {this.state.error?.toString() || "Unknown error"}
            </pre>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Reload App
              </button>

              <button
                onClick={this.handleResetCache}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: "#334155",
                  color: "#f8fafc",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

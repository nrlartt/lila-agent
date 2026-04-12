import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            minHeight: "100vh",
            background: "#0a0a0f",
            color: "#ff6b6b",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 13,
          }}
        >
          <h1 style={{ marginBottom: 12, fontSize: 16 }}>UI failed to render</h1>
          <pre style={{ whiteSpace: "pre-wrap", opacity: 0.9 }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root missing from index.html");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);

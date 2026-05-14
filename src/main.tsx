import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif", color: "#333" }}>
          <h2>Une erreur est survenue</h2>
          <pre style={{ color: "red", fontSize: 13 }}>{(this.state.error as Error).message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary><App /></ErrorBoundary>
);

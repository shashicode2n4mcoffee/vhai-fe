/**
 * Error Boundary — Catches React render errors and logs them to the server.
 * Renders a fallback UI with recovery option.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logErrorToServer } from "../lib/logError";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logErrorToServer(error.message, {
      details: [info.componentStack, error.stack].filter(Boolean).join("\n"),
      source: "ErrorBoundary",
    });
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-boundary" style={{
          padding: "2rem",
          textAlign: "center",
          maxWidth: "480px",
          margin: "2rem auto",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: "8px",
          background: "var(--surface, #f9fafb)",
        }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>Something went wrong</h2>
          <p style={{ margin: "0 0 1rem", color: "var(--muted, #6b7280)" }}>
            The error has been reported. You can try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--primary, #2563eb)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            style={{
              marginLeft: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

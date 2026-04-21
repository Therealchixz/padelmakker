import React from "react";
import * as Sentry from "@sentry/react";

function debugMode() {
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

/**
 * Undgår helt hvid skærm hvis en child kaster — viser i stedet en simpel fejlside (især nyttig på mobil).
 * Tilføj ?debug=1 i URL for at se fejltekst (midlertidig fejlsøgning).
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("PadelMakker render error:", err, info?.componentStack);
    Sentry.captureException(err, {
      extra: {
        componentStack: info?.componentStack || "",
      },
    });
  }

  render() {
    if (this.state.err) {
      const showDetail = debugMode();
      const msg = this.state.err?.message || String(this.state.err);
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#F0F4F8",
            color: "#0B1120",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Noget gik galt</p>
          <p style={{ fontSize: 14, color: "#3E4C63", maxWidth: 360, lineHeight: 1.5, marginBottom: 12 }}>
            Prøv at genindlæse siden. Virker det ikke, så ryd cache for websitet eller kontakt support.
          </p>
          {showDetail && (
            <pre
              style={{
                textAlign: "left",
                fontSize: 11,
                color: "#64748B",
                maxWidth: "min(100%, 420px)",
                overflow: "auto",
                padding: 12,
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                marginBottom: 16,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg}
            </pre>
          )}
          {!showDetail && (
            <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>
              (Til udviklere: åbn siden med <code>?debug=1</code> for fejlbesked)
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: "#1D4ED8",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Genindlæs
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

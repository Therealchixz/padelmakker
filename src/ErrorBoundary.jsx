import React from "react";

/**
 * Undgår helt hvid skærm hvis en child kaster — viser i stedet en simpel fejlside (især nyttig på mobil).
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
  }

  render() {
    if (this.state.err) {
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
          <p style={{ fontSize: 14, color: "#3E4C63", maxWidth: 360, lineHeight: 1.5, marginBottom: 20 }}>
            Prøv at genindlæse siden. Virker det ikke, så ryd cache for websitet eller kontakt support.
          </p>
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

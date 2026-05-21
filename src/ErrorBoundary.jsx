import React from "react";
import * as Sentry from "@sentry/react";
import { btn } from "./lib/platformTheme";

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
    this.state = { err: null, eventId: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("PadelMakker render error:", err, info?.componentStack);
    const eventId = Sentry.captureException(err, {
      extra: {
        componentStack: info?.componentStack || "",
      },
    });
    if (eventId) this.setState({ eventId });
  }

  render() {
    if (this.state.err) {
      const showDetail = debugMode();
      const msg = this.state.err?.message || String(this.state.err);
      const eventId = this.state.eventId;
      return (
        <div className="pm-error-boundary">
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Noget gik galt</p>
          <p style={{ fontSize: 14, color: "var(--pm-text-mid)", maxWidth: 360, lineHeight: 1.5, marginBottom: 12 }}>
            Prøv at genindlæse siden. Virker det ikke, så ryd cache for websitet eller kontakt support.
          </p>
          {showDetail && <pre>{msg}</pre>}
          {!showDetail && (
            <p style={{ fontSize: 12, color: "var(--pm-text-light)", marginBottom: 16 }}>
              (Til udviklere: åbn siden med <code>?debug=1</code> for fejlbesked)
            </p>
          )}
          {eventId && (
            <p style={{ fontSize: 11, color: "var(--pm-text-light)", marginBottom: 16 }}>
              Reference: <code style={{ userSelect: "all" }}>{eventId}</code>
            </p>
          )}
          <button type="button" onClick={() => window.location.reload()} style={{ ...btn(true), padding: "12px 20px", fontSize: "15px" }}>
            Genindlæs
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

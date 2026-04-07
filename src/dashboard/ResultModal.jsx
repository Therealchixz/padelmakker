import { useState, useEffect } from 'react';
import { InlineResultForm } from './InlineResultForm';

export function ResultModal({ team1Names, team2Names, onSubmit, onClose }) {
  // Dynamic import workaround - render inline form if PadelMatchResultInput unavailable
  const [ResultComp, setResultComp] = useState(null);
  useEffect(() => {
    import("../components/PadelMatchResultInput").then(mod => {
      setResultComp(() => mod.default);
    }).catch(() => {
      console.warn("PadelMatchResultInput not found, using inline form");
    });
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: "14px", padding: "24px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {ResultComp ? (
          <ResultComp
            playersEditable={false}
            initialData={{ team1: team1Names, team2: team2Names, sets: [], winner: null, completed: false }}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        ) : (
          <InlineResultForm team1Names={team1Names} team2Names={team2Names} onSubmit={onSubmit} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

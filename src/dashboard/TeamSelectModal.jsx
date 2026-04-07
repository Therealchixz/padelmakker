export function TeamSelectModal({ matchPlayers, onSelect, onClose }) {
  const team1 = matchPlayers.filter(p => Number(p.team) === 1);
  const team2 = matchPlayers.filter(p => Number(p.team) === 2);
  const team1Full = team1.length >= 2;
  const team2Full = team2.length >= 2;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "14px", padding: "28px", maxWidth: "360px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.02em" }}>Vælg hold</h3>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px", lineHeight: 1.5 }}>Hvilket hold vil du spille på?</p>

        <button
          onClick={() => onSelect(1)}
          disabled={team1Full}
          style={{ width: "100%", padding: "16px", marginBottom: "10px", borderRadius: "10px", border: "2px solid #1D4ED8", background: team1Full ? "#f1f5f9" : "#DBEAFE", color: team1Full ? "#94A3B8" : "#1D4ED8", fontSize: "15px", fontWeight: 700, cursor: team1Full ? "not-allowed" : "pointer", opacity: team1Full ? 0.5 : 1 }}
        >
          Hold 1 ({team1.length}/2)
          {team1.length > 0 && <div style={{ fontSize: "12px", fontWeight: 400, marginTop: "4px" }}>{team1.map(p => (p.user_name || "?").split(" ")[0]).join(", ")}</div>}
        </button>

        <button
          onClick={() => onSelect(2)}
          disabled={team2Full}
          style={{ width: "100%", padding: "16px", marginBottom: "16px", borderRadius: "10px", border: "2px solid #2563EB", background: team2Full ? "#f1f5f9" : "#EFF6FF", color: team2Full ? "#94A3B8" : "#2563EB", fontSize: "15px", fontWeight: 700, cursor: team2Full ? "not-allowed" : "pointer", opacity: team2Full ? 0.5 : 1 }}
        >
          Hold 2 ({team2.length}/2)
          {team2.length > 0 && <div style={{ fontSize: "12px", fontWeight: 400, marginTop: "4px" }}>{team2.map(p => (p.user_name || "?").split(" ")[0]).join(", ")}</div>}
        </button>

        <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "13px", cursor: "pointer" }}>
          Annullér
        </button>
      </div>
    </div>
  );
}

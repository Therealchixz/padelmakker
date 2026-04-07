import { useState } from 'react';

export function InlineResultForm({ team1Names, team2Names, onSubmit, onClose }) {
  const [sets, setSets] = useState([{ g1: "", g2: "" }, { g1: "", g2: "" }, { g1: "", g2: "" }]);

  const handleSubmit = () => {
    const parsedSets = sets.map((s, i) => ({
      setNumber: i + 1,
      gamesTeam1: parseInt(s.g1) || 0,
      gamesTeam2: parseInt(s.g2) || 0,
    })).filter(s => s.gamesTeam1 > 0 || s.gamesTeam2 > 0);

    let t1wins = 0, t2wins = 0;
    parsedSets.forEach(s => { if (s.gamesTeam1 > s.gamesTeam2) t1wins++; else if (s.gamesTeam2 > s.gamesTeam1) t2wins++; });
    const winner = t1wins > t2wins ? "team1" : t2wins > t1wins ? "team2" : null;

    onSubmit({
      team1: team1Names,
      team2: team2Names,
      sets: parsedSets,
      winner,
      completed: winner !== null,
    });
  };

  const setField = (idx, field, val) => {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  return (
    <div>
      <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Indrapportér resultat</h3>
      <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        <strong style={{ color: "#1D4ED8" }}>{team1Names}</strong> vs <strong style={{ color: "#2563EB" }}>{team2Names}</strong>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, width: "50px" }}>Sæt {i + 1}</span>
          <input type="number" min="0" max="7" value={sets[i].g1} onChange={e => setField(i, "g1", e.target.value)} placeholder="H1" style={{ width: "60px", padding: "8px", borderRadius: "6px", border: "1px solid #E2E8F0", textAlign: "center", fontSize: "16px" }} />
          <span style={{ fontWeight: 700 }}>-</span>
          <input type="number" min="0" max="7" value={sets[i].g2} onChange={e => setField(i, "g2", e.target.value)} placeholder="H2" style={{ width: "60px", padding: "8px", borderRadius: "6px", border: "1px solid #E2E8F0", textAlign: "center", fontSize: "16px" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px" }}>Annullér</button>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#1D4ED8", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Gem resultat</button>
      </div>
    </div>
  );
}

import { theme } from '../lib/platformTheme';
import PadelMatchResultInput from '../components/PadelMatchResultInput';

export function ResultModal({ team1Names, team2Names, onSubmit, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px", overflowY: "auto" }}>
      <div style={{ background: theme.surface, borderRadius: "14px", padding: "24px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + theme.border }}>
        <PadelMatchResultInput
          playersEditable={false}
          initialData={{ team1: team1Names, team2: team2Names, sets: [], winner: null, completed: false }}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

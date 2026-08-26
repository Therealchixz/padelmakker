import { theme, btn } from '../lib/platformTheme';
import { AppModal } from '../components/AppModal';

export function TeamSelectModal({ matchPlayers, onSelect, onClose }) {
  const team1 = matchPlayers.filter((p) => Number(p.team) === 1);
  const team2 = matchPlayers.filter((p) => Number(p.team) === 2);
  const team1Full = team1.length >= 2;
  const team2Full = team2.length >= 2;

  const teamBtnStyle = (full) => ({
    width: '100%',
    padding: '16px',
    marginBottom: '10px',
    borderRadius: '10px',
    border: '2px solid ' + theme.accent,
    background: full ? theme.surfaceAlt : theme.accentBg,
    color: full ? theme.textLight : theme.accent,
    fontSize: '15px',
    fontWeight: 700,
    cursor: full ? 'not-allowed' : 'pointer',
    opacity: full ? 0.5 : 1,
    fontFamily: 'inherit',
  });

  return (
    <AppModal open onClose={onClose} ariaLabel="Vælg hold" maxWidthPreset="sm">
      <div className="pm-modal-body">
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em', color: theme.text }}>Vælg hold</h3>
        <p style={{ fontSize: '13px', color: theme.textLight, marginBottom: '20px', lineHeight: 1.5 }}>Hvilket hold vil du spille på?</p>

        <button type="button" onClick={() => onSelect(1)} disabled={team1Full} style={teamBtnStyle(team1Full)}>
          Hold 1 ({team1.length}/2)
          {team1.length > 0 && (
            <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '4px' }}>
              {team1.map((p) => (p.user_name || '?').split(' ')[0]).join(', ')}
            </div>
          )}
        </button>

        <button type="button" onClick={() => onSelect(2)} disabled={team2Full} style={{ ...teamBtnStyle(team2Full), marginBottom: '16px' }}>
          Hold 2 ({team2.length}/2)
          {team2.length > 0 && (
            <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '4px' }}>
              {team2.map((p) => (p.user_name || '?').split(' ')[0]).join(', ')}
            </div>
          )}
        </button>

        <button type="button" onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
          Annullér
        </button>
      </div>
    </AppModal>
  );
}

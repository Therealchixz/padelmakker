import { theme, btn } from '../lib/platformTheme';
import { AppModal } from '../components/AppModal';
import { courtSideLabel, teamSlotsBySide } from '../lib/matchPlayerCourtSide';

function TeamSideGrid({ teamNum, players, onSelect }) {
  const slots = teamSlotsBySide(players);
  const teamFull = players.filter((p) => Number(p.team) === teamNum).length >= 2;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Hold {teamNum}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {slots.map(({ side, player }) => {
          const taken = Boolean(player);
          const disabled = taken || teamFull;
          return (
            <button
              key={`${teamNum}-${side}`}
              type="button"
              onClick={() => onSelect(teamNum, side)}
              disabled={disabled}
              style={{
                padding: '14px 10px',
                borderRadius: 12,
                border: `2px solid ${disabled ? theme.border : theme.accent}`,
                background: disabled ? theme.surfaceAlt : theme.accentBg,
                color: disabled ? theme.textLight : theme.accent,
                fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>{courtSideLabel(side)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: theme.textMid }}>
                {taken ? (player.user_name || 'Spiller').split(' ')[0] : 'Ledig'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TeamSelectModal({ matchPlayers, onSelect, onClose }) {
  const team1 = matchPlayers.filter((p) => Number(p.team) === 1);
  const team2 = matchPlayers.filter((p) => Number(p.team) === 2);

  return (
    <AppModal open onClose={onClose} ariaLabel="Vælg hold og side" maxWidthPreset="sm">
      <div className="pm-modal-body">
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em', color: theme.text }}>
          Vælg hold og side
        </h3>
        <p style={{ fontSize: '13px', color: theme.textLight, marginBottom: '18px', lineHeight: 1.5 }}>
          Hvilket hold og hvilken side vil du spille på?
        </p>

        <TeamSideGrid teamNum={1} players={team1} onSelect={onSelect} />
        <TeamSideGrid teamNum={2} players={team2} onSelect={onSelect} />

        <button type="button" onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
          Annullér
        </button>
      </div>
    </AppModal>
  );
}

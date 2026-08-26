import { useState } from 'react';
import { theme, btn } from '../lib/platformTheme';
import { AppModal } from '../components/AppModal';
import { courtSideLabel, freeMatchCourtSides, teamPlayerNameWithSide } from '../lib/matchPlayerCourtSide';

function teamRoster(matchPlayers, teamNum) {
  return (matchPlayers || []).filter((p) => Number(p.team) === teamNum);
}

function TeamPlayersHint({ players }) {
  if (!players.length) return null;
  return (
    <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '6px', lineHeight: 1.45 }}>
      {players.map((p) => (
        <div key={p.user_id || p.user_name}>{teamPlayerNameWithSide(p)}</div>
      ))}
    </div>
  );
}

export function TeamSelectModal({ matchPlayers, onSelect, onClose }) {
  const [pickedTeam, setPickedTeam] = useState(null);
  const team1 = teamRoster(matchPlayers, 1);
  const team2 = teamRoster(matchPlayers, 2);
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

  const pickTeam = (teamNum) => {
    const roster = teamNum === 1 ? team1 : team2;
    if (roster.length >= 2) return;
    const free = freeMatchCourtSides(roster);
    if (free.length === 2) {
      setPickedTeam(teamNum);
      return;
    }
    onSelect(teamNum, free[0] || null);
  };

  if (pickedTeam) {
    return (
      <AppModal open onClose={onClose} ariaLabel="Vælg side" maxWidthPreset="sm">
        <div className="pm-modal-body">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em', color: theme.text }}>
            Vælg side
          </h3>
          <p style={{ fontSize: '13px', color: theme.textLight, marginBottom: '20px', lineHeight: 1.5 }}>
            Begge sider er ledige på hold {pickedTeam}. Hvor vil du stå?
          </p>

          <button type="button" onClick={() => onSelect(pickedTeam, 'left')} style={teamBtnStyle(false)}>
            {courtSideLabel('left')}
          </button>
          <button
            type="button"
            onClick={() => onSelect(pickedTeam, 'right')}
            style={{ ...teamBtnStyle(false), marginBottom: '16px' }}
          >
            {courtSideLabel('right')}
          </button>

          <button
            type="button"
            onClick={() => setPickedTeam(null)}
            style={{ ...btn(false), width: '100%', justifyContent: 'center', marginBottom: '10px' }}
          >
            Tilbage
          </button>
          <button type="button" onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
            Annullér
          </button>
        </div>
      </AppModal>
    );
  }

  return (
    <AppModal open onClose={onClose} ariaLabel="Vælg hold" maxWidthPreset="sm">
      <div className="pm-modal-body">
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em', color: theme.text }}>Vælg hold</h3>
        <p style={{ fontSize: '13px', color: theme.textLight, marginBottom: '20px', lineHeight: 1.5 }}>Hvilket hold vil du spille på?</p>

        <button type="button" onClick={() => pickTeam(1)} disabled={team1Full} style={teamBtnStyle(team1Full)}>
          Hold 1 ({team1.length}/2)
          <TeamPlayersHint players={team1} />
        </button>

        <button type="button" onClick={() => pickTeam(2)} disabled={team2Full} style={{ ...teamBtnStyle(team2Full), marginBottom: '16px' }}>
          Hold 2 ({team2.length}/2)
          <TeamPlayersHint players={team2} />
        </button>

        <button type="button" onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
          Annullér
        </button>
      </div>
    </AppModal>
  );
}

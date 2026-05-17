import { theme } from '../lib/platformTheme';
import { formatWinPredictionPct } from '../lib/matchWinPrediction';

/**
 * Win-chance bar under kampbanen. Holdnavn og gns. ELO vises i pm-court-header.
 *
 * @param {{ prediction: { team1WinPct: number, team2WinPct: number, approximate: boolean, quality: string, eloDiff: number } }} props
 */
export function MatchWinPrediction({ prediction }) {
  if (!prediction) return null;

  const { team1WinPct, team2WinPct, approximate, quality, eloDiff } = prediction;
  const t1Label = formatWinPredictionPct(team1WinPct, approximate);
  const t2Label = formatWinPredictionPct(team2WinPct, approximate);

  return (
    <div
      className="pm-match-win-prediction"
      style={{ marginBottom: 14 }}
      aria-label="Forventet sejrssandsynlighed baseret på 2v2-ELO"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        <span style={{ color: theme.accent }}>{t1Label}</span>
        <span style={{ color: theme.textMid, fontWeight: 600, fontSize: 10 }}>
          {approximate ? 'Estimat' : 'Win-chance'}
        </span>
        <span style={{ color: theme.green }}>{t2Label}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: theme.border, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{ width: `${team1WinPct}%`, background: theme.accent, minWidth: team1WinPct > 0 ? 2 : 0 }}
        />
        <div style={{ width: '2px', background: '#FFFFFF', flexShrink: 0 }} />
        <div style={{ flex: 1, background: theme.green }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: theme.textMid, lineHeight: 1.45 }}>
        {quality}
        {eloDiff > 0 ? ` — ${eloDiff} ELO forskel` : ''}
        {approximate ? (
          <span style={{ display: 'block', marginTop: 2, fontSize: 10, opacity: 0.9 }}>
            Baseret på 2v2-ELO · lav datamængde på mindst én spiller
          </span>
        ) : null}
      </div>
    </div>
  );
}

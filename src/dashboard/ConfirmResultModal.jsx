import { AppModal } from '../components/AppModal';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../lib/matchDisplayUtils';

function SetDisplay({ set, setNum }) {
  const g1 = set?.[`set${setNum}_team1`];
  const g2 = set?.[`set${setNum}_team2`];
  if (g1 == null || g2 == null || (Number(g1) + Number(g2) === 0)) return null;
  return (
    <div style={{ textAlign: 'center' }}>
      <b style={{ fontSize: 21, fontWeight: 700, color: 'var(--pm-navy)', letterSpacing: 1, display: 'block' }}>
        {g1}–{g2}
      </b>
      <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 600, color: 'var(--pm-text-mid)', letterSpacing: 1, marginTop: 2 }}>
        SÆT {setNum}
      </span>
    </div>
  );
}

export function ConfirmResultModal({
  open,
  onClose,
  matchResult,
  match,
  team1Names,
  team2Names,
  submitterName,
  onConfirm,
  onReject,
  busy = false,
}) {
  if (!open || !matchResult) return null;

  const winner = matchResult.match_winner;
  const winnerNames = winner === 'team1' ? team1Names : winner === 'team2' ? team2Names : null;

  return (
    <AppModal open onClose={busy ? undefined : onClose} ariaLabel="Bekræft resultat" maxWidthPreset="sm">
      <div className="pm-modal-body" style={{ fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }}>
        {/* Eyebrow */}
        <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color: 'var(--pm-text-mid)' }}>
          Bekræft resultat
        </div>

        {/* Who submitted */}
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, marginTop: 8 }}>
          {submitterName ? `${submitterName} har indberettet jeres kamp` : 'Et resultat er blevet indberettet'}
        </div>

        {/* Date + venue */}
        {match && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--pm-text-mid)', marginTop: 3 }}>
            {formatMatchDateHeadlineDa(match.date)} · {matchTimeLabel(match)}
            {match.court_name ? ` · ${match.court_name}` : ''}
          </div>
        )}

        {/* Result strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '12px 0' }}>
          <SetDisplay set={matchResult} setNum={1} />
          <SetDisplay set={matchResult} setNum={2} />
          <SetDisplay set={matchResult} setNum={3} />
        </div>

        {/* Winner tag */}
        {winnerNames && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 999,
              background: 'var(--pm-green-bg)', color: 'var(--pm-green)',
            }}>
              {winnerNames} vandt
            </span>
          </div>
        )}

        {/* Confirm button */}
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none',
            background: busy ? 'var(--pm-border)' : 'var(--pm-navy)', color: 'var(--pm-on-accent)',
            fontSize: '14.5px', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit', boxShadow: busy ? 'none' : '0 6px 14px rgba(22,55,126,0.32)',
          }}
        >
          Godkend resultat
        </button>

        {/* Reject button */}
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          style={{
            width: '100%', padding: 11, borderRadius: 10, marginTop: 9,
            border: '1.5px solid var(--pm-border)', background: 'var(--pm-surface)',
            color: 'var(--pm-red)', fontSize: '14.5px', fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          Afvis — det er forkert
        </button>

        {/* Note */}
        <div style={{ textAlign: 'center', fontSize: '10.5px', color: 'var(--pm-text-mid)', marginTop: 11 }}>
          Elo-point fordeles, når alle har godkendt
        </div>
      </div>
    </AppModal>
  );
}

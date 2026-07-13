import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import PadelMatchResultInput from '../components/PadelMatchResultInput';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../lib/matchDisplayUtils';
import { theme } from '../lib/platformTheme';

function SuccessView({ result, team1Names, team2Names, match, onClose }) {
  const sets = (result?.sets || []).filter((s) => s.gamesTeam1 >= 0 && s.gamesTeam2 >= 0);
  const winner = result?.winner;
  const wonLabel = winner === 'team1' ? team1Names : winner === 'team2' ? team2Names : null;

  return (
    <div style={{ padding: '0 4px 8px', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }}>
      {/* Success circle */}
      <div style={{
        width: 74, height: 74, borderRadius: '50%',
        background: theme.navy, color: theme.onAccent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '20px auto 18px',
        boxShadow: theme.shadowAccent,
      }}>
        <Check size={32} strokeWidth={2.8} />
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.3, color: theme.text }}>
          Resultatet er indsendt<br />til godkendelse
        </div>
        <p style={{ fontSize: '12.5px', color: theme.textMid, lineHeight: 1.6, marginTop: 9 }}>
          Dine modstandere har modtaget resultatet og skal godkende det, før det tæller med i jeres statistikker og Elo-rating.
        </p>
      </div>

      {/* Match summary card */}
      <div style={{
        background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`,
        boxShadow: theme.shadowSoft, padding: 16, margin: '18px 0 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: theme.text }}>Kamp-opsummering</span>
          {wonLabel && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
              background: theme.amberBg, color: theme.amberText, border: `1px solid ${theme.amberBorder}`,
            }}>
              {winner === 'team1' ? 'Vundet' : 'Tabt'}
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: theme.accent }}>{team1Names}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {sets.length > 0 ? sets.map((s, i) => (
              <div key={i} style={{
                fontSize: i === 0 ? 23 : 15,
                fontWeight: 700,
                color: i === 0 ? theme.navy : theme.textMid,
                letterSpacing: i === 0 ? 2 : 1,
                lineHeight: 1.25,
              }}>
                {s.gamesTeam1} : {s.gamesTeam2}
              </div>
            )) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.textMid }}>—</div>
            )}
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: theme.accent }}>{team2Names}</div>
          </div>
        </div>

        {/* Match meta */}
        {match && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
            marginTop: 14, paddingTop: 12, borderTop: `1px solid ${theme.border}`,
            fontSize: '11.5px', color: theme.textMid, fontWeight: 600,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {formatMatchDateHeadlineDa(match.date)} · {matchTimeLabel(match)}
            {match.court_name ? ` · ${match.court_name}` : ''}
          </div>
        )}
      </div>

      {/* Honest status (not a fake progress bar) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        margin: '18px 0 0', padding: '8px 12px', borderRadius: 999,
        background: theme.accentBg, color: theme.accent,
        fontSize: 12, fontWeight: 700,
      }}>
        <Clock size={14} aria-hidden />
        Venter på modstandernes godkendelse
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 20, width: '100%', padding: '13px', borderRadius: 'var(--pm-radius-md)',
          border: `1.5px solid ${theme.border}`, background: theme.surface, color: theme.accent,
          fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          minHeight: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        Luk
      </button>
    </div>
  );
}

export function ResultModal({ team1Names, team2Names, match, onSubmit, onClose }) {
  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);

  const handleSubmit = async (padelResult) => {
    setPhase('loading');
    try {
      const outcome = await onSubmit(padelResult);
      if (outcome && outcome.ok === false) {
        setErrorMsg(outcome.reason || 'Resultatet er ikke gyldigt. Prøv igen.');
        setPhase('error');
        return;
      }
      setSubmittedResult(padelResult);
      setPhase('success');
    } catch (e) {
      setErrorMsg(e?.message || 'Prøv igen');
      setPhase('error');
    }
  };

  if (phase === 'success') {
    return (
      <AppModal open onClose={onClose} ariaLabel="Resultat indsendt" maxWidthPreset="md">
        <div className="pm-modal-body pm-modal-body--compact">
          <SuccessView
            result={submittedResult}
            team1Names={team1Names}
            team2Names={team2Names}
            match={match}
            onClose={onClose}
          />
        </div>
      </AppModal>
    );
  }

  return (
    <AppModal open onClose={phase === 'loading' ? undefined : onClose} ariaLabel="Indtast kampresultat" maxWidthPreset="md">
      <div className="pm-modal-body pm-modal-body--compact">
        {phase === 'error' && (
          <div style={{
            background: theme.redBg, border: `1px solid ${theme.dangerBorder}`, borderRadius: 'var(--pm-radius-md)',
            padding: '10px 14px', marginBottom: 14, fontSize: '13px', color: theme.red,
          }}>
            {errorMsg}
          </div>
        )}
        <PadelMatchResultInput
          playersEditable={false}
          initialData={{ team1: team1Names, team2: team2Names, sets: [], winner: null, completed: false }}
          onSubmit={handleSubmit}
          onCancel={phase === 'loading' ? undefined : onClose}
        />
      </div>
    </AppModal>
  );
}

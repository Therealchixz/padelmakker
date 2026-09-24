import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { font, theme } from '../lib/platformTheme';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { levelCheckSuggestion, shouldShowLevelCheck } from '../lib/levelCheck.js';

/** "Passede niveauet?" på Hjem efter de første 1–3 kampe (se levelCheck.js). */
export function LevelCheckCard({ user, showToast }) {
  const { user: authUser, updateProfile } = useAuth();
  const [answer, setAnswer] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (hidden || !shouldShowLevelCheck(user, authUser?.user_metadata || null)) return null;

  const level = Number(user.level);
  const games = Number(user.games_played) || 0;
  const suggestion = answer ? levelCheckSuggestion(level, answer) : null;

  const finish = async (chosenAnswer, newLevel) => {
    setBusy(true);
    try {
      if (newLevel != null) await updateProfile({ level: newLevel });
      await supabase.auth.updateUser({
        data: { level_check_at: new Date().toISOString(), level_check_answer: chosenAnswer },
      });
      if (newLevel != null) showToast?.(`Dit niveau er nu ${formatPlaytomicLevel(newLevel)}.`);
      else if (chosenAnswer === 'passede') showToast?.('Tak! Godt at høre.');
    } catch {
      showToast?.('Kunne ikke gemme. Prøv igen.', 'error');
      setBusy(false);
      return;
    }
    setHidden(true);
  };

  const pick = (a) => {
    if (a === 'passede') {
      void finish(a, null);
      return;
    }
    setAnswer(a);
  };

  const btn = (primary) => ({
    flex: 1,
    minWidth: 0,
    padding: '11px 8px',
    borderRadius: 12,
    border: primary ? 'none' : `1.5px solid ${theme.border}`,
    background: primary ? theme.navy : theme.surface,
    color: primary ? 'var(--pm-on-accent)' : theme.text,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: busy ? 'default' : 'pointer',
    fontFamily: font,
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div className="pm-ui-card" style={{ margin: '4px 18px 12px', padding: '14px 16px', fontFamily: font }}>
      {!answer ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>
            Passede niveauet i {games === 1 ? 'din første kamp' : 'dine første kampe'}?
          </div>
          <div style={{ fontSize: 13, color: theme.textMid, margin: '3px 0 12px' }}>
            Du står som niveau {formatPlaytomicLevel(level)}. Så matcher vi dig bedre.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} style={btn(false)} onClick={() => pick('for_let')}>For let</button>
            <button type="button" disabled={busy} style={btn(true)} onClick={() => pick('passede')}>Passede</button>
            <button type="button" disabled={busy} style={btn(false)} onClick={() => pick('for_svaert')}>For svært</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>
            {answer === 'for_let' ? 'Skal vi hæve dit niveau?' : 'Skal vi sænke dit niveau?'}
          </div>
          <div style={{ fontSize: 13, color: theme.textMid, margin: '3px 0 12px' }}>
            {suggestion != null
              ? `Fra ${formatPlaytomicLevel(level)} til ${formatPlaytomicLevel(suggestion)}. Du kan altid rette det under Profil.`
              : 'Du kan rette dit niveau under Profil.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {suggestion != null ? (
              <button type="button" disabled={busy} style={btn(true)} onClick={() => void finish(answer, suggestion)}>
                Ja, sæt {formatPlaytomicLevel(suggestion)}
              </button>
            ) : null}
            <button type="button" disabled={busy} style={btn(false)} onClick={() => void finish(answer, null)}>
              Nej, behold {formatPlaytomicLevel(level)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { theme } from '../lib/platformTheme';
import PadelMatchResultInput from './PadelMatchResultInput';
import { adminCorrectMatchResultAndRecalcElo } from '../lib/adminCorrectMatchResult';
import { buildMatchResultUpdateFields } from '../lib/matchResultPayload';
import { matchResultRowToPadelResult } from '../lib/matchResultFromRow';
import { validateMatchRosterForElo, validateSubmittedPadelResult } from '../lib/padelResultGuards';
import { useConfirm } from '../lib/ConfirmDialogProvider';

export function AdminMatchResultEditor({ match, matchResult, players, onClose, onSaved }) {
  const ask = useConfirm();
  const [busy, setBusy] = useState(false);

  const team1 = (players || []).filter((p) => Number(p.team) === 1);
  const team2 = (players || []).filter((p) => Number(p.team) === 2);
  const team1Names = team1.map((p) => p.profiles?.full_name || p.user_name || 'Spiller').join(' / ');
  const team2Names = team2.map((p) => p.profiles?.full_name || p.user_name || 'Spiller').join(' / ');

  const initialData = useMemo(
    () => matchResultRowToPadelResult(matchResult, team1Names || 'Hold 1', team2Names || 'Hold 2'),
    [matchResult, team1Names, team2Names],
  );

  const handleSubmit = async (result) => {
    const rosterCheck = validateMatchRosterForElo(players);
    if (!rosterCheck.ok) {
      await ask({ message: rosterCheck.reason, notice: true });
      return;
    }
    const resultCheck = validateSubmittedPadelResult(result);
    if (!resultCheck.ok) {
      await ask({ message: resultCheck.reason, notice: true });
      return;
    }

    const ok = await ask({
      message:
        'Ret resultatet og genberegn ELO for alle fire spillere? Dette kan ikke fortrydes automatisk.',
      confirmLabel: 'Ja, ret og genberegn',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const fields = buildMatchResultUpdateFields({ players, result });
      const res = await adminCorrectMatchResultAndRecalcElo(matchResult.id, fields);
      await ask({
        message: `Resultat opdateret (${fields.score_display}). ELO er genberegnet for ${res.elo?.players_updated ?? 4} spillere.`,
        notice: true,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke rette resultatet', notice: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={() => !busy && onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15,23,42,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          borderRadius: 14,
          padding: 20,
          maxWidth: 520,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowLg,
        }}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: theme.text }}>
          Ret kampresultat (admin)
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>
          {match?.court_name || 'Kamp'} · ELO genberegnes automatisk for alle spillere.
        </p>
        {busy ? (
          <p style={{ fontSize: 13, color: theme.textMid, textAlign: 'center', padding: 24 }}>
            Genberegner ELO…
          </p>
        ) : (
          <PadelMatchResultInput
            playersEditable={false}
            initialData={initialData}
            onSubmit={(r) => { void handleSubmit(r); }}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

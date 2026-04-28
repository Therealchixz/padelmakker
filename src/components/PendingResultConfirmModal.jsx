import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, btn, font } from '../lib/platformTheme';
import { supabase } from '../lib/supabase';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import { createNotification } from '../lib/notifications';
import { resolveDisplayName } from '../lib/platformUtils';
import { formatMatchDateDa, matchTimeLabel } from '../lib/matchDisplayUtils';

/**
 * Globalt pop-up som tvinger brugeren til at forholde sig til ubekræftede
 * resultater på kampe de selv spiller — men ikke selv har indsendt.
 *
 * Vises kun når der findes mindst ét ubekræftet resultat hvor:
 *   - brugeren er deltager i kampen (match_players)
 *   - brugeren IKKE er submitter (mr.submitted_by !== user.id)
 *   - mr.confirmed = false
 *
 * Brugeren har tre muligheder:
 *   - Bekræft resultat  → UPDATE + ELO + notifikationer
 *   - Afvis resultat    → DELETE + notifikationer (kræver fix RLS-policy)
 *   - Vis kampen        → naviger til kampen og luk popup midlertidigt
 */
export function PendingResultConfirmModal({ user }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]); // [{ result, match, submitterName }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const reloadRef = useRef(null);

  const userId = user?.id;
  const myDisplayName = resolveDisplayName(user, user);

  const load = useCallback(async () => {
    if (!userId) {
      setPending([]);
      return;
    }
    try {
      const { data: myPlayerRows, error: mpErr } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('user_id', userId)
        .limit(2000);
      if (mpErr) throw mpErr;
      const matchIds = [...new Set((myPlayerRows || []).map((r) => r.match_id).filter(Boolean))];
      if (!matchIds.length) {
        setPending([]);
        return;
      }

      const { data: results, error: mrErr } = await supabase
        .from('match_results')
        .select('id, match_id, submitted_by, sets_won_team1, sets_won_team2, score_display, match_winner, created_at')
        .in('match_id', matchIds)
        .eq('confirmed', false)
        .neq('submitted_by', userId)
        .order('created_at', { ascending: true });
      if (mrErr) throw mrErr;
      if (!results?.length) {
        setPending([]);
        return;
      }

      const submitterIds = [...new Set(results.map((r) => r.submitted_by).filter(Boolean))];
      const matchIdsForResults = [...new Set(results.map((r) => r.match_id).filter(Boolean))];

      const [submittersRes, matchesRes] = await Promise.all([
        submitterIds.length
          ? supabase.from('profiles').select('id, name, full_name').in('id', submitterIds)
          : Promise.resolve({ data: [] }),
        matchIdsForResults.length
          ? supabase.from('matches').select('id, date, time, time_end, court_name').in('id', matchIdsForResults)
          : Promise.resolve({ data: [] }),
      ]);

      const submitterById = {};
      (submittersRes.data || []).forEach((p) => { submitterById[p.id] = p; });
      const matchById = {};
      (matchesRes.data || []).forEach((m) => { matchById[m.id] = m; });

      const merged = results
        .filter((r) => matchById[r.match_id])
        .map((r) => ({
          result: r,
          match: matchById[r.match_id],
          submitterName: resolveDisplayName(submitterById[r.submitted_by], submitterById[r.submitted_by]) || 'En spiller',
        }));
      setPending(merged);
    } catch (e) {
      console.warn('PendingResultConfirmModal load:', e?.message || e);
      setPending([]);
    }
  }, [userId]);

  reloadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: opdater når en relevant notifikation lander til denne bruger
  // (notifications-tabellen er allerede i supabase_realtime publication og virker
  // pålideligt; match_results er det typisk ikke). Vi reagerer både på
  // result_submitted (nyt resultat venter på bekræftelse) og
  // result_confirmed/match_cancelled (en anden tog stilling, fjern modal).
  useEffect(() => {
    if (!userId) return undefined;
    const RELEVANT_TYPES = new Set([
      'result_submitted',
      'result_confirmed',
      'match_cancelled',
    ]);
    const channel = supabase
      .channel('pending-result-modal-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + userId,
        },
        (payload) => {
          const type = payload?.new?.type;
          if (type && RELEVANT_TYPES.has(type)) {
            if (reloadRef.current) void reloadRef.current();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results' },
        () => {
          if (reloadRef.current) void reloadRef.current();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Fallback: re-load når appen kommer i forgrunden eller får fokus.
  // Dækker iOS PWA hvor WebSocket dør i baggrunden, og almindelige
  // tab-skift hvor klienten missede et realtime-event.
  useEffect(() => {
    if (!userId) return undefined;
    const onVisible = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        if (reloadRef.current) void reloadRef.current();
      }
    };
    const onFocus = () => {
      if (reloadRef.current) void reloadRef.current();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [userId]);

  // Aktuelle "ikke-dismissede" pending-rækker
  const visible = pending.filter((p) => !dismissedIds.has(p.result.id));
  const current = visible[0];

  if (!current) return null;

  const { result, match, submitterName } = current;
  const totalCount = visible.length;

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: updateErr } = await supabase
        .from('match_results')
        .update({ confirmed: true, confirmed_by: userId })
        .eq('id', result.id);
      if (updateErr) throw updateErr;

      try {
        await calculateAndApplyElo(result.match_id, () => {}, { matchResultId: result.id });
      } catch (eloErr) {
        console.warn('apply elo on modal confirm:', eloErr?.message || eloErr);
      }

      // Notify alle deltagere om bekræftet resultat
      try {
        const { data: players } = await supabase
          .from('match_players')
          .select('user_id')
          .eq('match_id', result.match_id);
        (players || []).forEach((p) => {
          if (!p.user_id) return;
          createNotification(
            p.user_id,
            'result_confirmed',
            'Resultat bekræftet! 🏆',
            `Kampen er afsluttet (${result.score_display || '—'}). Personlig ELO er opdateret.`,
            result.match_id,
          );
        });
      } catch (notifyErr) {
        console.warn('notify on modal confirm:', notifyErr?.message || notifyErr);
      }

      await load();
    } catch (e) {
      setError('Kunne ikke bekræfte: ' + (e?.message || 'Prøv igen'));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: deleteErr } = await supabase
        .from('match_results')
        .delete()
        .eq('id', result.id);
      if (deleteErr) throw deleteErr;

      // Notifikation til submitter
      if (result.submitted_by) {
        createNotification(
          result.submitted_by,
          'result_submitted',
          'Resultat afvist ❌',
          `${myDisplayName} har afvist dit indberettede resultat. Indrapportér igen.`,
          result.match_id,
        );
      }

      // Notifikation til admins (på nær brugeren selv)
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .neq('id', userId);
        (admins || []).forEach((a) => {
          createNotification(
            a.id,
            'result_submitted',
            'Resultat afvist ❌',
            `${myDisplayName} har afvist et indberettet resultat. Kampen venter på et nyt resultat.`,
            result.match_id,
          );
        });
      } catch (notifyErr) {
        console.warn('notify admins on modal reject:', notifyErr?.message || notifyErr);
      }

      await load();
    } catch (e) {
      setError('Kunne ikke afvise: ' + (e?.message || 'Prøv igen'));
    } finally {
      setBusy(false);
    }
  };

  const handleViewMatch = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(result.id);
      return next;
    });
    navigate('/dashboard/kampe?focus=' + encodeURIComponent(result.match_id));
  };

  const dateLabel = match?.date ? formatMatchDateDa(match.date) : '';
  const timeLabel = match ? matchTimeLabel(match) : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-pending-result-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2900,
        padding: '20px',
        fontFamily: font,
      }}
    >
      <div
        style={{
          background: theme.surface,
          borderRadius: '14px',
          padding: '22px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid ' + theme.border,
        }}
      >
        <p
          id="pm-pending-result-title"
          style={{ fontSize: '16px', fontWeight: 700, color: theme.text, marginBottom: '6px' }}
        >
          Bekræft kampresultat
        </p>
        <p style={{ fontSize: '13px', color: theme.textMid, marginBottom: '14px', lineHeight: 1.45 }}>
          {submitterName} har indsendt et resultat til en af dine kampe. Bekræft eller afvis før kampen
          kan afsluttes og ELO opdateres.
        </p>

        <div
          style={{
            background: theme.surfaceAlt,
            border: '1px solid ' + theme.border,
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '12px',
            fontSize: '13px',
            color: theme.text,
          }}
        >
          {dateLabel && (
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              {dateLabel} kl. {timeLabel}
            </div>
          )}
          {match?.court_name && (
            <div style={{ color: theme.textMid, fontSize: '12px', marginBottom: '8px' }}>
              {match.court_name}
            </div>
          )}
          <div style={{ fontSize: '15px', fontWeight: 700, color: theme.accent }}>
            {result.score_display || '—'}
          </div>
        </div>

        {error && (
          <p
            style={{
              fontSize: '12px',
              color: theme.red,
              marginBottom: '10px',
              padding: '8px 10px',
              background: theme.redBg,
              borderRadius: '8px',
              border: '1px solid ' + theme.red + '40',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            style={{ ...btn(true), width: '100%', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Arbejder…' : 'Bekræft resultat'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy}
            style={{
              ...btn(false),
              width: '100%',
              justifyContent: 'center',
              color: theme.red,
              borderColor: theme.red + '55',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Afvis resultat
          </button>
          <button
            type="button"
            onClick={handleViewMatch}
            disabled={busy}
            style={{
              ...btn(false),
              width: '100%',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Vis kampen i detaljer
          </button>
        </div>

        {totalCount > 1 && (
          <p style={{ fontSize: '11px', color: theme.textLight, marginTop: '12px', textAlign: 'center' }}>
            Du har {totalCount} ubekræftede resultater. Næste vises efter dette.
          </p>
        )}
      </div>
    </div>
  );
}

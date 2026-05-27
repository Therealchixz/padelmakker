import { useCallback, useEffect, useState } from 'react';
import { theme, btn, inputStyle } from '../lib/platformTheme';
import { AppModal } from './AppModal';
import { supabase } from '../lib/supabase';
import { adminCorrectAmericanoTournament } from '../lib/adminCorrectAmericano';
import { complementAmericanoScore, isValidAmericanoScore } from '../lib/americanoScore';
import { useConfirm } from '../lib/ConfirmDialogProvider';

export function AdminAmericanoResultEditor({ tournament, onClose, onSaved }) {
  const ask = useConfirm();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState({});

  const ppm = Number(tournament.points_per_match);
  const P = ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16;

  const nameByPartId = useCallback(
    (pid) => participants.find((p) => p.id === pid)?.display_name || '?',
    [participants],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        supabase.from('americano_participants').select('*').eq('tournament_id', tournament.id),
        supabase
          .from('americano_matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('round_number', { ascending: true })
          .order('court_index', { ascending: true }),
      ]);
      const plist = pRes.data || [];
      const mlist = mRes.data || [];
      setParticipants(plist);
      setMatches(mlist);
      const sc = {};
      mlist.forEach((m) => {
        const bothSet = m.team_a_score != null && m.team_b_score != null;
        sc[m.id] = {
          a: bothSet ? String(m.team_a_score) : '',
          b: bothSet ? String(m.team_b_score) : '',
        };
      });
      setScores(sc);
    } catch (e) {
      console.warn('AdminAmericanoResultEditor load:', e);
    } finally {
      setLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveScores = (matchId) => {
    const row = scores[matchId] || { a: '', b: '' };
    let aStr = row.a.trim();
    let bStr = row.b.trim();
    if (aStr !== '' && bStr === '') {
      const o = complementAmericanoScore(aStr, P);
      if (o == null) return null;
      bStr = String(o);
    } else if (bStr !== '' && aStr === '') {
      const o = complementAmericanoScore(bStr, P);
      if (o == null) return null;
      aStr = String(o);
    }
    if (aStr === '' || bStr === '') return null;
    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    if (!isValidAmericanoScore(a, b, P)) return null;
    return { a, b };
  };

  const handleSave = async () => {
    const payload = [];
    for (const m of matches) {
      const resolved = resolveScores(m.id);
      if (!resolved) {
        await ask({
          message: `Udfyld gyldige resultater for alle kampe (summen skal være ${P}).`,
          notice: true,
        });
        return;
      }
      payload.push({
        id: m.id,
        team_a_score: resolved.a,
        team_b_score: resolved.b,
      });
    }

    const ok = await ask({
      message:
        'Ret alle turneringsresultater og genberegn Turnerings-ELO for deltagerne? Dette kan ikke fortrydes automatisk.',
      confirmLabel: 'Ja, ret og genberegn',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await adminCorrectAmericanoTournament(tournament.id, payload);
      await ask({
        message: `Resultater opdateret. Turnerings-ELO genberegnet for ${res.elo?.players_updated ?? 'alle'} spillere.`,
        notice: true,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke gemme', notice: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      open
      onClose={onClose}
      ariaLabel="Ret turneringsresultater (admin)"
      maxWidth={560}
      zIndex={1100}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      contentStyle={{ maxHeight: '92vh' }}
    >
      <div className="pm-modal-body pm-modal-body--compact" style={{ overflowY: 'auto', maxHeight: '92vh' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: theme.text }}>
          Ret turneringsresultater (admin)
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>
          {tournament.name} · Format {P} point · Turnerings-ELO genberegnes for alle deltagere.
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: theme.textMid, textAlign: 'center', padding: 24 }}>Henter kampe…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map((m) => {
              const row = scores[m.id] || { a: '', b: '' };
              const draft = resolveScores(m.id);
              return (
                <div
                  key={m.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    background: theme.surfaceAlt,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMid, marginBottom: 8 }}>
                    Runde {m.round_number} · Bane {m.court_index + 1}
                  </div>
                  <div style={{ fontSize: 12, color: theme.text, marginBottom: 8, lineHeight: 1.4 }}>
                    {nameByPartId(m.team_a_p1)} / {nameByPartId(m.team_a_p2)}
                    <span style={{ margin: '0 6px', color: theme.textLight }}>vs</span>
                    {nameByPartId(m.team_b_p1)} / {nameByPartId(m.team_b_p2)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min={0}
                      max={P}
                      value={row.a}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [m.id]: { ...row, a: e.target.value },
                        }))
                      }
                      style={{ ...inputStyle, width: 56, textAlign: 'center', padding: '8px 6px' }}
                      disabled={busy}
                    />
                    <span style={{ fontSize: 12, color: theme.textMid }}>–</span>
                    <input
                      type="number"
                      min={0}
                      max={P}
                      value={row.b}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [m.id]: { ...row, b: e.target.value },
                        }))
                      }
                      style={{ ...inputStyle, width: 56, textAlign: 'center', padding: '8px 6px' }}
                      disabled={busy}
                    />
                    {draft ? (
                      <span style={{ fontSize: 11, color: theme.green, fontWeight: 700 }}>OK</span>
                    ) : (
                      <span style={{ fontSize: 11, color: theme.red }}>Ugyldig</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => void handleSave()} disabled={busy} style={{ ...btn(true), flex: 1 }}>
                {busy ? 'Genberegner…' : 'Gem og genberegn ELO'}
              </button>
              <button type="button" onClick={onClose} disabled={busy} style={{ ...btn(false) }}>
                Annuller
              </button>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}

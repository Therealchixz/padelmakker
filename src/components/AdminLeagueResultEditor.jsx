import { useCallback, useEffect, useState } from 'react';
import { theme, btn, inputStyle } from '../lib/platformTheme';
import { AppModal } from './AppModal';
import { supabase } from '../lib/supabase';
import { adminCorrectLeagueMatch } from '../lib/adminCorrectLeagueMatch';
import { validatePadelScore } from '../lib/ligaScore';
import { useConfirm } from '../lib/ConfirmDialogProvider';

export function AdminLeagueResultEditor({ league, onClose, onSaved }) {
  const ask = useConfirm();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [drafts, setDrafts] = useState({});

  const teamName = useCallback(
    (id) => teams.find((t) => t.id === id)?.name || 'Hold',
    [teams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, mRes] = await Promise.all([
        supabase.from('league_teams').select('*').eq('league_id', league.id),
        supabase
          .from('league_matches')
          .select('*')
          .eq('league_id', league.id)
          .eq('status', 'reported')
          .order('round_number', { ascending: true }),
      ]);
      const teamRows = tRes.data || [];
      const matchRows = mRes.data || [];
      setTeams(teamRows);
      setMatches(matchRows);
      const d = {};
      matchRows.forEach((m) => {
        d[m.id] = {
          winnerId: m.winner_id || m.team1_id,
          score: m.score_text || '',
        };
      });
      setDrafts(d);
    } catch (e) {
      console.warn('AdminLeagueResultEditor load:', e);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMatch = async (match) => {
    const draft = drafts[match.id];
    if (!draft?.winnerId) {
      await ask({ message: 'Vælg vinder.', notice: true });
      return;
    }
    const scoreErr = validatePadelScore(draft.score);
    if (scoreErr) {
      await ask({ message: scoreErr, notice: true });
      return;
    }

    const ok = await ask({
      message: `Ret resultatet for ${teamName(match.team1_id)} vs ${teamName(match.team2_id)}? Stillingen i ligaen opdateres.`,
      confirmLabel: 'Ja, gem',
      danger: true,
    });
    if (!ok) return;

    setBusyId(match.id);
    try {
      await adminCorrectLeagueMatch(match.id, draft.winnerId, draft.score.trim());
      await ask({ message: 'Kampresultat opdateret.', notice: true });
      await load();
      onSaved?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke gemme', notice: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppModal
      open
      onClose={onClose}
      ariaLabel="Ret liga-resultater (admin)"
      maxWidth={520}
      zIndex={1100}
      closeOnBackdrop={!busyId}
      closeOnEscape={!busyId}
      contentStyle={{ maxHeight: '92vh' }}
    >
      <div className="pm-modal-body pm-modal-body--compact" style={{ overflowY: 'auto', maxHeight: '92vh' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: theme.text }}>
          Ret liga-resultater (admin)
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>
          {league.name} · Kun rapporterede kampe · Ingen ELO — stillingen genberegnes i appen.
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: theme.textMid, textAlign: 'center', padding: 24 }}>Henter kampe…</p>
        ) : matches.length === 0 ? (
          <p style={{ fontSize: 13, color: theme.textMid }}>Ingen rapporterede kampe i denne liga.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map((m) => {
              const draft = drafts[m.id] || { winnerId: m.winner_id, score: m.score_text || '' };
              const isBusy = busyId === m.id;
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
                    Runde {m.round_number}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 10 }}>
                    {teamName(m.team1_id)}
                    {m.team2_id ? ` vs ${teamName(m.team2_id)}` : ' (fri runde)'}
                  </div>
                  {m.team2_id ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {[m.team1_id, m.team2_id].map((tid) => (
                          <button
                            key={tid}
                            type="button"
                            disabled={!!busyId}
                            onClick={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...draft, winnerId: tid },
                              }))
                            }
                            style={{
                              ...btn(draft.winnerId === tid),
                              padding: '6px 10px',
                              fontSize: 12,
                            }}
                          >
                            {teamName(tid)} vandt
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="6-4"
                        value={draft.score}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [m.id]: { ...draft, score: e.target.value },
                          }))
                        }
                        style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
                        disabled={!!busyId}
                      />
                      <button
                        type="button"
                        onClick={() => void saveMatch(m)}
                        disabled={!!busyId}
                        style={{ ...btn(true), width: '100%', fontSize: 13 }}
                      >
                        {isBusy ? 'Gemmer…' : 'Gem kamp'}
                      </button>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: theme.textMid, margin: 0 }}>Fri runde — intet at rette.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={!!busyId}
          style={{ ...btn(false), width: '100%', marginTop: 14 }}
        >
          Luk
        </button>
      </div>
    </AppModal>
  );
}

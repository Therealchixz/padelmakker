import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import { theme, btn } from '../lib/platformTheme';
import { formatMatchDateDa, fmtClock } from '../lib/matchDisplayUtils';

export function InviteToMatchModal({ invitee, currentUser, showToast, onClose }) {
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null); // "match-<id>" eller "americano-<id>"

  const inviteeName = invitee.full_name || invitee.name || 'Spilleren';
  const senderName = currentUser.full_name || currentUser.name || 'En spiller';

  useEffect(() => {
    async function load() {
      const [matchRes, tourRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, date, time, description, status')
          .eq('creator_id', currentUser.id)
          .in('status', ['open', 'full'])
          .order('date', { ascending: true })
          .limit(20),
        supabase
          .from('americano_tournaments')
          .select('id, name, tournament_date, time_slot, description, status')
          .eq('creator_id', currentUser.id)
          .in('status', ['registration', 'in_progress'])
          .order('tournament_date', { ascending: true })
          .limit(20),
      ]);
      setMatches(matchRes.data || []);
      setTournaments(tourRes.data || []);
      setLoading(false);
    }
    load();
  }, [currentUser.id]);

  const handleInviteMatch = async (match) => {
    const key = `match-${match.id}`;
    setSending(key);
    const dateStr = formatMatchDateDa(match.date);
    const timeStr = fmtClock(match.time);
    const desc = match.description ? ` — "${match.description}"` : '';

    await createNotification(
      invitee.id,
      'match_invite',
      `${senderName} inviterer dig til padel! 🎾`,
      `Du er inviteret til en kamp ${dateStr} kl. ${timeStr}${desc}. Gå til Kampe for at tilmelde dig.`,
      match.id
    );

    showToast(`Invitation sendt til ${inviteeName}! 🎾`);
    onClose();
  };

  const handleInviteTournament = async (t) => {
    const key = `americano-${t.id}`;
    setSending(key);
    const dateStr = formatMatchDateDa(t.tournament_date);
    const timeStr = fmtClock(t.time_slot);
    const desc = t.description ? ` — "${t.description}"` : '';

    await createNotification(
      invitee.id,
      'match_invite',
      `${senderName} inviterer dig til Americano! 🏆`,
      `Du er inviteret til "${t.name}" ${dateStr} kl. ${timeStr}${desc}. Gå til Kampe → Americano for at tilmelde dig.`,
      t.id
    );

    showToast(`Invitation sendt til ${inviteeName}! 🏆`);
    onClose();
  };

  const hasAnything = matches.length > 0 || tournaments.length > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: theme.surface, borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid ' + theme.border }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>
          Invitér {inviteeName}
        </h3>
        <p style={{ fontSize: '13px', color: theme.textMid, marginBottom: '20px', lineHeight: 1.5 }}>
          Vælg hvilken af dine kampe eller turneringer du vil invitere dem til:
        </p>

        {loading ? (
          <p style={{ color: theme.textLight, fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Henter dine kampe…
          </p>
        ) : !hasAnything ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: theme.textLight }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎾</div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
              Ingen åbne kampe
            </p>
            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
              {
                'Opret en kamp eller Americano-turnering under fanen "Kampe" — så kan du invitere spillere til den.'
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {matches.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  Padel-kampe
                </div>
                {matches.map(m => {
                  const key = `match-${m.id}`;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleInviteMatch(m)}
                      disabled={sending === key}
                      style={{
                        ...btn(false),
                        textAlign: 'left',
                        padding: '12px 14px',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '3px',
                        opacity: sending === key ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>
                        {formatMatchDateDa(m.date)} kl. {fmtClock(m.time)}
                      </span>
                      {m.description && (
                        <span style={{ fontSize: '12px', color: theme.textMid }}>{m.description}</span>
                      )}
                      {sending === key && (
                        <span style={{ fontSize: '11px', color: theme.accent }}>Sender invitation…</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {tournaments.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: matches.length > 0 ? '10px' : '0', marginBottom: '2px' }}>
                  Americano-turneringer
                </div>
                {tournaments.map(t => {
                  const key = `americano-${t.id}`;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleInviteTournament(t)}
                      disabled={sending === key}
                      style={{
                        ...btn(false),
                        textAlign: 'left',
                        padding: '12px 14px',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '3px',
                        opacity: sending === key ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: '12px', color: theme.textMid }}>
                        {formatMatchDateDa(t.tournament_date)} kl. {fmtClock(t.time_slot)}
                      </span>
                      {t.description && (
                        <span style={{ fontSize: '12px', color: theme.textMid }}>{t.description}</span>
                      )}
                      {sending === key && (
                        <span style={{ fontSize: '11px', color: theme.accent }}>Sender invitation…</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        <button onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
          Luk
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import { theme, btn } from '../lib/platformTheme';
import { formatMatchDateDa, fmtClock } from '../lib/matchDisplayUtils';

export function InviteToMatchModal({ invitee, currentUser, showToast, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null); // id på kamp der inviteres til

  const inviteeName = invitee.full_name || invitee.name || 'Spilleren';
  const senderName = currentUser.full_name || currentUser.name || 'En spiller';

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('creator_id', currentUser.id)
        .eq('status', 'open')
        .order('date', { ascending: true })
        .limit(20);
      setMatches(data || []);
      setLoading(false);
    }
    load();
  }, [currentUser.id]);

  const handleInvite = async (match) => {
    setSending(match.id);
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>
          Invitér {inviteeName}
        </h3>
        <p style={{ fontSize: '13px', color: theme.textMid, marginBottom: '20px', lineHeight: 1.5 }}>
          Vælg hvilken af dine åbne kampe du vil invitere dem til:
        </p>

        {loading ? (
          <p style={{ color: theme.textLight, fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Henter dine kampe…
          </p>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: theme.textLight }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎾</div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
              Ingen åbne kampe
            </p>
            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
              Opret en kamp under fanen "Kampe" — så kan du invitere spillere til den.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {matches.map(m => (
              <button
                key={m.id}
                onClick={() => handleInvite(m)}
                disabled={sending === m.id}
                style={{
                  ...btn(false),
                  textAlign: 'left',
                  padding: '12px 14px',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '3px',
                  opacity: sending === m.id ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>
                  {formatMatchDateDa(m.date)} kl. {fmtClock(m.time)}
                </span>
                {m.description && (
                  <span style={{ fontSize: '12px', color: theme.textMid }}>{m.description}</span>
                )}
                {sending === m.id && (
                  <span style={{ fontSize: '11px', color: theme.accent }}>Sender invitation…</span>
                )}
              </button>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
          Luk
        </button>
      </div>
    </div>
  );
}

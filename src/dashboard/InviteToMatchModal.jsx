import { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import { theme } from '../lib/platformTheme';
import { AppModal } from '../components/AppModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { fmtClock } from '../lib/matchDisplayUtils';

const DA_MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAJ','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];

function DateBadge({ dateStr }) {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  return (
    <div style={{
      width: 42, flexShrink: 0, textAlign: 'center',
      background: 'var(--pm-surface-muted)', border: '1px solid var(--pm-border)', borderRadius: 10, padding: '6px 0',
    }}>
      <b style={{ display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{day || '—'}</b>
      <span style={{ fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--pm-text-mid)', letterSpacing: '0.5px' }}>
        {month ? DA_MONTHS_SHORT[month - 1] : '—'}
      </span>
    </div>
  );
}

function MatchRow({ item, selected, onSelect }) {
  const key = `${item._type}-${item.id}`;
  const isSel = selected === key;
  const date = item._type === 'match' ? item.date : item.tournament_date;
  const time = item._type === 'match' ? item.time : item.time_slot;
  const venue = item._type === 'match' ? (item.court_name || '2v2-kamp') : (item.name || 'Americano');
  const typeLabel = item._type === 'match' ? '2v2' : 'Americano';

  return (
    <button
      type="button"
      onClick={() => onSelect(isSel ? null : key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13,
        background: 'var(--pm-surface)', border: `1.5px solid ${isSel ? 'var(--pm-navy)' : 'var(--pm-border)'}`,
        borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
        boxShadow: isSel ? '0 0 0 3px rgba(22,55,126,0.12)' : 'none',
        marginBottom: 9, width: '100%', textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <DateBadge dateStr={date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 14, fontWeight: 600, display: 'block', color: 'var(--pm-text)' }}>
          {typeLabel} · {venue}
        </b>
        <span style={{ fontSize: '11.5px', color: 'var(--pm-text-mid)', display: 'block', marginTop: 2 }}>
          Kl. {fmtClock(time)}
        </span>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${isSel ? 'var(--pm-navy)' : 'var(--pm-border)'}`,
        background: isSel ? 'var(--pm-navy)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--pm-on-accent)',
      }}>
        {isSel && <Check size={12} strokeWidth={3} />}
      </div>
    </button>
  );
}

export function InviteToMatchModal({ invitee, currentUser, showToast, onClose, onInviteSent, onCreateMatch }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);

  const inviteeName = (invitee.full_name || invitee.name || 'Spilleren').split(' ')[0];
  const senderName = currentUser.full_name || currentUser.name || 'En spiller';

  useEffect(() => {
    async function load() {
      const [matchRes, tourRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, date, time, court_name, description, status')
          .eq('creator_id', currentUser.id)
          .in('status', ['open', 'full'])
          .order('date', { ascending: true })
          .limit(10),
        supabase
          .from('americano_tournaments')
          .select('id, name, tournament_date, time_slot, description, status')
          .eq('creator_id', currentUser.id)
          .in('status', ['registration', 'in_progress'])
          .order('tournament_date', { ascending: true })
          .limit(10),
      ]);
      setItems([
        ...(matchRes.data || []).map((m) => ({ ...m, _type: 'match' })),
        ...(tourRes.data || []).map((t) => ({ ...t, _type: 'americano' })),
      ]);
      setLoading(false);
    }
    void load();
  }, [currentUser.id]);

  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    const item = items.find((it) => `${it._type}-${it.id}` === selected);
    if (!item) { setSending(false); return; }
    try {
      if (item._type === 'match') {
        const { DateTime } = await import('luxon');
        const dt = DateTime.fromISO(item.date);
        const dateStr = dt.setLocale('da').toFormat('EEE d. MMM');
        const timeStr = fmtClock(item.time);
        const desc = item.description ? ` - "${item.description}"` : '';
        await createNotification(
          invitee.id, 'match_invite',
          `${senderName} inviterer dig til padel!`,
          `Du er inviteret til en kamp ${dateStr} kl. ${timeStr}${desc}. Gå til Kampe for at tilmelde dig.`,
          item.id
        );
        onInviteSent?.({ candidateId: invitee.id, matchId: item.id });
      } else {
        const { DateTime } = await import('luxon');
        const dt = DateTime.fromISO(item.tournament_date);
        const dateStr = dt.setLocale('da').toFormat('EEE d. MMM');
        const timeStr = fmtClock(item.time_slot);
        const desc = item.description ? ` - "${item.description}"` : '';
        await createNotification(
          invitee.id, 'americano_invite',
          `${senderName} inviterer dig til en Americano/Mexicano!`,
          `Du er inviteret til "${item.name}" ${dateStr} kl. ${timeStr}${desc}. Gå til Kampe → Americano/Mexicano for at tilmelde dig.`,
          null, { entityType: 'americano', entityId: item.id }
        );
      }
      showToast(`Invitation sendt til ${inviteeName}! 🎾`);
      onClose();
    } catch {
      showToast('Kunne ikke sende invitation. Prøv igen.');
      setSending(false);
    }
  };

  return (
    <AppModal open onClose={onClose} ariaLabel={`Inviter ${inviteeName}`} maxWidthPreset="sm" contentStyle={{ maxHeight: '80vh' }}>
      <div className="pm-modal-body pm-modal-body--compact" style={{ overflowY: 'auto', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }}>

        {/* Player header */}
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 14 }}>
          <AvatarCircle avatar={invitee.avatar} size={42} emojiSize="20px" style={{ background: theme.accentBg, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>
              Invitér {inviteeName} til en kamp
            </div>
            <div style={{ fontSize: '11.5px', color: theme.textMid, marginTop: 1 }}>
              Vælg en af dine kampe med ledig plads
            </div>
          </div>
        </div>

        {/* Match list */}
        {loading ? (
          <p style={{ color: theme.textLight, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Henter dine kampe...
          </p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0 8px', color: theme.textMid, fontSize: 13 }}>
            Ingen åbne kampe. Opret en kamp under "Kampe".
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            {items.map((item) => (
              <MatchRow
                key={`${item._type}-${item.id}`}
                item={item}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}

        {/* Opret ny kamp button */}
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: 11, borderRadius: 10, marginBottom: 12,
            border: '1.5px solid var(--pm-border)', background: 'var(--pm-surface)',
            color: 'var(--pm-navy)', fontSize: '14.5px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
          onClick={() => { if (onCreateMatch) onCreateMatch(); else onClose(); }}
        >
          <Plus size={16} />
          Opret ny kamp
        </button>

        {/* Send invitation */}
        <button
          type="button"
          disabled={!selected || sending}
          onClick={handleSend}
          style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none',
            background: selected && !sending ? 'var(--pm-navy)' : 'var(--pm-border)',
            color: 'var(--pm-on-accent)', fontSize: '14.5px', fontWeight: 600,
            cursor: selected && !sending ? 'pointer' : 'default',
            fontFamily: 'inherit',
            boxShadow: selected && !sending ? '0 6px 14px rgba(22,55,126,0.32)' : 'none',
          }}
        >
          {sending ? 'Sender...' : 'Send invitation'}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', padding: 10, borderRadius: 10, marginTop: 9,
            border: 'none', background: 'none', color: 'var(--pm-text-mid)',
            fontSize: '14.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Annullér
        </button>
      </div>
    </AppModal>
  );
}

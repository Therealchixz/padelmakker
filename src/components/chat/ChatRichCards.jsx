import { MapPin, Swords } from 'lucide-react';

export function ChatInviteCard({ invite, mine, onJoin, joining = false }) {
  if (!invite) return null;
  const isOpen = invite.status !== 'full';

  return (
    <div className="pm-chat-v2-invite-card">
      <div className="pm-chat-v2-invite-head">
        <div className="pm-chat-v2-invite-kicker">
          <Swords size={13} aria-hidden />
          Kamp-invitation
        </div>
        <div className="pm-chat-v2-invite-title">{invite.title}</div>
      </div>
      <div className="pm-chat-v2-invite-body">
        <div className="pm-chat-v2-invite-venue">
          <MapPin size={12} aria-hidden />
          {invite.venue}
        </div>
        <div className="pm-chat-v2-invite-foot">
          <span className={`pm-chat-v2-invite-badge${isOpen ? '' : ' pm-chat-v2-invite-badge--full'}`}>
            {isOpen ? 'Åben' : 'Fuldt'} · {invite.players}
          </span>
          {!mine && isOpen ? (
            <button
              type="button"
              className="pm-chat-v2-invite-join"
              onClick={() => onJoin?.(invite)}
              disabled={joining}
            >
              {joining ? 'Tilmelder…' : 'Tilmeld'}
            </button>
          ) : null}
          {mine ? <span className="pm-chat-v2-invite-sent">Sendt</span> : null}
        </div>
      </div>
    </div>
  );
}

export function ChatVenueCard({ payload }) {
  if (!payload) return null;
  return (
    <div className="pm-chat-v2-rich-card pm-chat-v2-rich-card--venue">
      <div className="pm-chat-v2-rich-kicker">📍 Bane</div>
      <div className="pm-chat-v2-rich-title">{payload.venue}</div>
      {payload.city ? <div className="pm-chat-v2-rich-sub">{payload.city}</div> : null}
      {payload.url ? (
        <a href={payload.url} target="_blank" rel="noreferrer" className="pm-chat-v2-rich-link">
          Se booking
        </a>
      ) : null}
    </div>
  );
}

export function ChatTimeCard({ payload, mine = false, onAccept, accepting = false }) {
  if (!payload) return null;
  return (
    <div className="pm-chat-v2-rich-card pm-chat-v2-rich-card--time">
      <div className="pm-chat-v2-rich-kicker">📅 Tidforslag</div>
      <div className="pm-chat-v2-rich-title">{payload.label || `${payload.date} · ${payload.time}`}</div>
      {!mine && onAccept ? (
        <button
          type="button"
          className="pm-chat-v2-rich-accept"
          onClick={onAccept}
          disabled={accepting}
        >
          {accepting ? 'Sender…' : 'Passer mig'}
        </button>
      ) : null}
      {mine ? <div className="pm-chat-v2-rich-sub">Sendt</div> : null}
    </div>
  );
}

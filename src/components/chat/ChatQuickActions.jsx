import { Calendar, MapPin, Swords } from 'lucide-react';

export function ChatQuickActions({ onInviteMatch, onShareVenue, onSuggestTime }) {
  return (
    <div className="pm-chat-v2-quick-actions">
      <button type="button" className="pm-chat-v2-quick-action pm-chat-v2-quick-action--blue" onClick={onInviteMatch}>
        <Swords size={14} aria-hidden />
        Invitér til kamp
      </button>
      <button type="button" className="pm-chat-v2-quick-action pm-chat-v2-quick-action--green" onClick={onShareVenue}>
        <MapPin size={14} aria-hidden />
        Del bane
      </button>
      <button type="button" className="pm-chat-v2-quick-action pm-chat-v2-quick-action--amber" onClick={onSuggestTime}>
        <Calendar size={14} aria-hidden />
        Foreslå tid
      </button>
    </div>
  );
}

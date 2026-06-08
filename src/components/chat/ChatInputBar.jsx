import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { ChatQuickActions } from './ChatQuickActions';
import { QUICK_EMOJIS } from '../../lib/chatMessageUtils';

export function ChatInputBar({
  value,
  onChange,
  onSend,
  onKeyDown,
  onTyping,
  placeholder = 'Besked…',
  disabled = false,
  sending = false,
  inputRef,
  enableQuickActions = false,
  onInviteMatch,
  onShareVenue,
  onSuggestTime,
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const hasText = value.trim().length > 0;

  const handleChange = (next) => {
    onChange(next);
    onTyping?.();
  };

  return (
    <div className="pm-chat-v2-input-bar">
      {enableQuickActions && showActions ? (
        <ChatQuickActions
          onInviteMatch={() => { setShowActions(false); onInviteMatch?.(); }}
          onShareVenue={() => { setShowActions(false); onShareVenue?.(); }}
          onSuggestTime={() => { setShowActions(false); onSuggestTime?.(); }}
        />
      ) : null}

      {showEmoji ? (
        <div className="pm-chat-v2-emoji-row">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="pm-chat-v2-emoji-btn"
              onClick={() => onChange(`${value}${emoji}`)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pm-chat-v2-input-row">
        {enableQuickActions ? (
          <button
            type="button"
            className={`pm-chat-v2-input-plus${showActions ? ' pm-chat-v2-input-plus--active' : ''}`}
            disabled={disabled}
            aria-label="Hurtige handlinger"
            onClick={() => { setShowActions((v) => !v); setShowEmoji(false); }}
          >
            <Plus size={20} aria-hidden />
          </button>
        ) : null}
        <div className="pm-chat-v2-input-field-wrap">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => handleChange(e.target.value.slice(0, 1000))}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="pm-chat-v2-input-field"
            maxLength={1000}
            disabled={disabled || sending}
          />
          <button
            type="button"
            className="pm-chat-v2-input-emoji-btn"
            aria-label="Emoji"
            onClick={() => { setShowEmoji((v) => !v); setShowActions(false); }}
          >
            🙂
          </button>
        </div>
        <button
          type="button"
          className={`pm-chat-v2-input-send${hasText ? ' pm-chat-v2-input-send--active' : ''}`}
          onClick={() => { if (hasText) void onSend(); }}
          disabled={disabled || sending || !hasText}
          aria-label="Send besked"
        >
          <Send size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

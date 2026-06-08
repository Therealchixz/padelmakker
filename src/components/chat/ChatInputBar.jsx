import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import { Plus, Send } from 'lucide-react';
import { ChatQuickActions } from './ChatQuickActions';
import { QUICK_EMOJIS } from '../../lib/chatMessageUtils';

/** Ca. 5–6 linjer — derefter scroll inde i feltet. */
const CHAT_INPUT_MAX_HEIGHT_PX = 132;
const CHAT_INPUT_MIN_HEIGHT_PX = 22;

function resizeChatInput(el) {
  if (!el) return;
  el.style.height = '0px';
  const next = Math.min(Math.max(el.scrollHeight, CHAT_INPUT_MIN_HEIGHT_PX), CHAT_INPUT_MAX_HEIGHT_PX);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > CHAT_INPUT_MAX_HEIGHT_PX ? 'auto' : 'hidden';
}

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
  const fieldRef = useRef(null);
  const hasText = value.trim().length > 0;

  const setFieldRef = useCallback((node) => {
    fieldRef.current = node;
  }, []);

  useLayoutEffect(() => {
    const node = fieldRef.current;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef != null) {
      // Forward ref til parent (fx focus/blur i BeskedTab).
      // eslint-disable-next-line react-hooks/immutability -- standard ref-forwarding
      inputRef.current = node;
    }
    resizeChatInput(node);
  }, [value, placeholder, disabled, sending, inputRef]);

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
          <textarea
            ref={setFieldRef}
            rows={1}
            value={value}
            onChange={(e) => handleChange(e.target.value.slice(0, 1000))}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="pm-chat-v2-input-field"
            maxLength={1000}
            disabled={disabled || sending}
            aria-label={placeholder}
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

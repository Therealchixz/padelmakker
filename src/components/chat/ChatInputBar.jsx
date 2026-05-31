import { Plus, Send, Smile } from 'lucide-react';

export function ChatInputBar({
  value,
  onChange,
  onSend,
  onKeyDown,
  placeholder = 'Besked…',
  disabled = false,
  sending = false,
  inputRef,
}) {
  const hasText = value.trim().length > 0;

  return (
    <div className="pm-chat-v2-input-bar">
      <div className="pm-chat-v2-input-row">
        <button
          type="button"
          className="pm-chat-v2-input-plus"
          disabled={disabled}
          aria-label="Flere handlinger"
          title="Kommer snart"
        >
          <Plus size={20} aria-hidden />
        </button>
        <div className="pm-chat-v2-input-field-wrap">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 1000))}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="pm-chat-v2-input-field"
            maxLength={1000}
            disabled={disabled || sending}
          />
          <Smile size={20} className="pm-chat-v2-input-emoji" aria-hidden />
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

import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatTypingBubble } from './ChatTypingBubble';
import { isSameSender, withDateDividers } from '../../lib/chatDisplayUtils';
import { normalizeChatMessage } from '../../lib/chatMessageUtils';

export function ChatMessageList({
  messages = [],
  userId,
  loading = false,
  error = '',
  emptyText = 'Ingen beskeder endnu.',
  groupMode = false,
  showSenderNames = false,
  loadOlderSlot = null,
  listRef: externalListRef,
  onScroll,
  className = '',
  typingVisible = false,
  onReact,
  onJoinInvite,
  joiningInviteId = null,
}) {
  const internalRef = useRef(null);
  const listRef = externalListRef || internalRef;

  const normalized = messages.map((msg) => normalizeChatMessage(msg, userId)).filter(Boolean);

  const withDates = withDateDividers(normalized, (m) => m.createdAt);

  let lastMineIndex = -1;
  withDates.forEach((item, i) => {
    if (item.type !== 'date' && item.from === 'me') lastMineIndex = i;
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    el.scrollTop = el.scrollHeight;
  }, [loading, messages.length, typingVisible, listRef]);

  return (
    <div
      ref={listRef}
      className={`pm-chat-v2-message-list${className ? ` ${className}` : ''}`}
      onScroll={onScroll}
    >
      {loading && <div className="pm-chat-v2-message-status">Indlæser beskeder…</div>}
      {!loading && error && <div className="pm-chat-v2-message-status">{error}</div>}
      {!loading && !error && messages.length === 0 && !typingVisible && (
        <div className="pm-chat-v2-message-empty">{emptyText}</div>
      )}
      {loadOlderSlot}
      <div className="pm-chat-v2-message-stack">
        {withDates.map((item, i) => {
          if (item.type === 'date') {
            return (
              <div key={item.id} className="pm-chat-v2-date-divider">
                <span>{item.label}</span>
              </div>
            );
          }

          const prev = withDates[i - 1];
          const next = withDates[i + 1];
          const prevMsg = prev && prev.type !== 'date' ? prev : null;
          const nextMsg = next && next.type !== 'date' ? next : null;
          const sameType = (a, b) => isSameSender(a, b) && (a.messageType || 'text') === (b.messageType || 'text');
          const groupedWithPrev = prevMsg && sameType(prevMsg, item) && groupMode;
          const groupedWithNext = nextMsg && sameType(nextMsg, item) && groupMode;
          const showAvatar = groupMode && item.from === 'them' && !groupedWithNext;

          return (
            <div
              key={item.id}
              className={`pm-chat-v2-message-item${groupedWithPrev ? ' pm-chat-v2-message-item--grouped' : ''}`}
            >
              <ChatBubble
                message={item}
                groupedWithNext={groupedWithNext}
                groupedWithPrev={groupedWithPrev}
                showAvatar={showAvatar}
                showReadReceipt={i === lastMineIndex}
                showSenderName={showSenderNames && item.from === 'them' && !groupedWithPrev}
                avatarId={item.senderId}
                avatarName={item.senderName}
                avatarUrl={item.senderAvatar}
                onReact={onReact}
                onJoinInvite={onJoinInvite}
                joiningInviteId={joiningInviteId}
              />
            </div>
          );
        })}
        {typingVisible ? (
          <div className="pm-chat-v2-message-item pm-chat-v2-message-item--typing">
            <ChatTypingBubble />
          </div>
        ) : null}
      </div>
    </div>
  );
}

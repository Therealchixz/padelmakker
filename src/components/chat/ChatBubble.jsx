import { useState } from 'react';
import { ChatInitialsAvatar } from './ChatInitialsAvatar';
import { ChatInviteCard, ChatTimeCard, ChatVenueCard } from './ChatRichCards';
import { ChatTypingBubble } from './ChatTypingBubble';
import { formatBubbleTime } from '../../lib/chatDisplayUtils';
import { CHAT_MESSAGE_TYPES, QUICK_REACTIONS } from '../../lib/chatMessageUtils';

export function ChatBubble({
  message,
  groupedWithNext = false,
  groupedWithPrev = false,
  showAvatar = false,
  showReadReceipt = false,
  avatarId,
  avatarName,
  avatarUrl = null,
  showSenderName = false,
  onReact,
  onJoinInvite,
  joiningInviteId = null,
}) {
  const mine = message.from === 'me';
  const messageType = message.messageType || message.message_type || CHAT_MESSAGE_TYPES.TEXT;
  const [showReactions, setShowReactions] = useState(false);

  if (messageType === 'typing' || message.type === 'typing') {
    return <ChatTypingBubble />;
  }

  const bubbleRadius = mine
    ? (groupedWithNext ? 'pm-chat-v2-bubble--mine-mid' : 'pm-chat-v2-bubble--mine-last')
    : (groupedWithNext ? 'pm-chat-v2-bubble--them-mid' : 'pm-chat-v2-bubble--them-last');

  const isRich = messageType !== CHAT_MESSAGE_TYPES.TEXT;

  return (
    <div className={`pm-chat-v2-bubble-wrap ${mine ? 'pm-chat-v2-bubble-wrap--mine' : 'pm-chat-v2-bubble-wrap--them'}`}>
      <div className="pm-chat-v2-bubble-row">
        {!mine && (
          <div className="pm-chat-v2-bubble-avatar-slot">
            {showAvatar ? (
              <ChatInitialsAvatar
                id={avatarId || message.senderId}
                name={avatarName || message.senderName}
                avatar={avatarUrl || message.senderAvatar}
                size={28}
              />
            ) : null}
          </div>
        )}
        <div className="pm-chat-v2-bubble-col">
          {showSenderName && !mine && message.senderName ? (
            <div className="pm-chat-v2-bubble-sender">{message.senderName}</div>
          ) : null}
          <div
            className="pm-chat-v2-bubble-shell"
            onContextMenu={(e) => {
              if (!onReact) return;
              e.preventDefault();
              setShowReactions((v) => !v);
            }}
          >
            {messageType === CHAT_MESSAGE_TYPES.MATCH_INVITE ? (
              <ChatInviteCard
                invite={message.payload}
                mine={mine}
                onJoin={onJoinInvite}
                joining={joiningInviteId === message.payload?.match_id}
              />
            ) : messageType === CHAT_MESSAGE_TYPES.VENUE_SHARE ? (
              <ChatVenueCard payload={message.payload} />
            ) : messageType === CHAT_MESSAGE_TYPES.TIME_SUGGESTION ? (
              <ChatTimeCard payload={message.payload} />
            ) : (
              <div className={`pm-chat-v2-bubble ${mine ? 'pm-chat-v2-bubble--mine' : 'pm-chat-v2-bubble--them'} ${bubbleRadius}`}>
                {message.text}
              </div>
            )}

            {message.reaction ? (
              <div className={`pm-chat-v2-bubble-reaction ${mine ? 'pm-chat-v2-bubble-reaction--mine' : 'pm-chat-v2-bubble-reaction--them'}`}>
                {message.reaction}
              </div>
            ) : null}

            {showReactions && onReact ? (
              <div className={`pm-chat-v2-reaction-picker ${mine ? 'pm-chat-v2-reaction-picker--mine' : 'pm-chat-v2-reaction-picker--them'}`}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setShowReactions(false);
                      onReact(message, emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {!groupedWithNext && (
        <div className={`pm-chat-v2-bubble-meta ${mine ? 'pm-chat-v2-bubble-meta--mine' : 'pm-chat-v2-bubble-meta--them'}${isRich ? ' pm-chat-v2-bubble-meta--rich' : ''}`}>
          <span>{formatBubbleTime(message.createdAt)}</span>
          {mine && showReadReceipt && message.status === 'read' ? (
            <span className="pm-chat-v2-bubble-read">· Læst</span>
          ) : null}
          {onReact && messageType === CHAT_MESSAGE_TYPES.TEXT ? (
            <button type="button" className="pm-chat-v2-bubble-react-btn" onClick={() => setShowReactions((v) => !v)}>
              +
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

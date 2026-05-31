import { ChatInitialsAvatar } from './ChatInitialsAvatar';
import { formatBubbleTime } from '../../lib/chatDisplayUtils';

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
}) {
  const mine = message.from === 'me';

  const bubbleRadius = mine
    ? (groupedWithNext ? 'pm-chat-v2-bubble--mine-mid' : 'pm-chat-v2-bubble--mine-last')
    : (groupedWithNext ? 'pm-chat-v2-bubble--them-mid' : 'pm-chat-v2-bubble--them-last');

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
          <div className={`pm-chat-v2-bubble ${mine ? 'pm-chat-v2-bubble--mine' : 'pm-chat-v2-bubble--them'} ${bubbleRadius}`}>
            {message.text}
          </div>
        </div>
      </div>
      {!groupedWithNext && (
        <div className={`pm-chat-v2-bubble-meta ${mine ? 'pm-chat-v2-bubble-meta--mine' : 'pm-chat-v2-bubble-meta--them'}`}>
          <span>{formatBubbleTime(message.createdAt)}</span>
          {mine && showReadReceipt && message.status === 'read' ? (
            <span className="pm-chat-v2-bubble-read">· Læst</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

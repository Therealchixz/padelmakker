import { ChevronLeft, MoreVertical } from 'lucide-react';
import { ChatInitialsAvatar } from './ChatInitialsAvatar';

export function ChatThreadHeader({
  title,
  subtitle = '',
  avatarId,
  avatarName,
  avatarUrl = null,
  online = false,
  onBack,
  actionsSlot = null,
}) {
  return (
    <div className="pm-chat-v2-thread-header">
      <button type="button" className="pm-chat-v2-thread-back" onClick={onBack} aria-label="Tilbage">
        <ChevronLeft size={24} aria-hidden />
      </button>
      <ChatInitialsAvatar
        id={avatarId}
        name={avatarName || title}
        avatar={avatarUrl}
        size={38}
        online={online}
      />
      <div className="pm-chat-v2-thread-head-main">
        <div className="pm-chat-v2-thread-title">{title}</div>
        {subtitle ? (
          <div className={`pm-chat-v2-thread-sub${online ? ' pm-chat-v2-thread-sub--online' : ''}`}>{subtitle}</div>
        ) : null}
      </div>
      {actionsSlot || (
        <button type="button" className="pm-chat-v2-thread-more" aria-label="Flere valg" disabled>
          <MoreVertical size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

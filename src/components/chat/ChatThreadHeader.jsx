import { ChevronLeft } from 'lucide-react';
import { ChatInitialsAvatar } from './ChatInitialsAvatar';
import { tag, theme } from '../../lib/platformTheme';

export function ChatThreadHeader({
  title,
  subtitle = '',
  avatarId,
  avatarName,
  avatarUrl = null,
  online = false,
  onBack,
  actionsSlot = null,
  levelTag = null,
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
      {levelTag && (
        <span style={tag(theme.amberBg, theme.amberText)}>{levelTag}</span>
      )}
      {actionsSlot || null}
    </div>
  );
}

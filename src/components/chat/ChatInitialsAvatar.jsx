import { AvatarCircle } from '../AvatarCircle';
import { colorFromId, initialsFromName } from '../../lib/chatDisplayUtils';

export function ChatInitialsAvatar({
  id,
  name = '',
  avatar = null,
  size = 36,
  online = false,
  className = '',
}) {
  const color = colorFromId(id || name);
  const initials = initialsFromName(name);

  return (
    <div className={`pm-chat-v2-avatar-wrap${className ? ` ${className}` : ''}`}>
      {avatar ? (
        <AvatarCircle avatar={avatar} size={size} emojiSize={`${Math.round(size * 0.38)}px`} />
      ) : (
        <div
          className="pm-chat-v2-initials-avatar"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.38,
            color,
            background: `${color}22`,
          }}
          aria-hidden={!name}
        >
          {initials}
        </div>
      )}
      {online ? <span className="pm-chat-v2-avatar-online" style={{ width: size * 0.28, height: size * 0.28 }} aria-hidden /> : null}
    </div>
  );
}

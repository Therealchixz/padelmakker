import { AvatarCircle } from '../AvatarCircle';

/**
 * @param {{
 *   userId?: string | null,
 *   profile?: { full_name?: string | null, name?: string | null, avatar?: string | null } | null,
 *   currentUserId?: string | null,
 *   onProfileClick?: (profile: object) => void,
 *   subtitle?: string,
 * }} props
 */
export function CreatorProfileRow({
  userId,
  profile,
  currentUserId = null,
  onProfileClick,
  subtitle = 'Oprettet af',
}) {
  if (!userId) return null;

  const name = String(profile?.full_name || profile?.name || 'Spiller').trim() || 'Spiller';
  const isMe = currentUserId != null && String(currentUserId) === String(userId);
  const label = isMe ? 'Dig' : name;
  const avatar = profile?.avatar || '\u{1F3BE}';
  const clickable = Boolean(onProfileClick && profile);

  const content = (
    <>
      <AvatarCircle avatar={avatar} size={34} emojiSize="18px" />
      <div className="pm-kd-creator-copy">
        <div className="pm-kd-creator-name">{label}</div>
        <div className="pm-kd-creator-sub">{subtitle}</div>
      </div>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="pm-kd-card pm-kd-creator-row"
        onClick={(event) => {
          event.stopPropagation();
          onProfileClick(profile);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="pm-kd-card pm-kd-creator-row">
      {content}
    </div>
  );
}

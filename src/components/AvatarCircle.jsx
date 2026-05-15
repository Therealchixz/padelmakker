import { isAvatarUrl } from '../lib/avatarUpload';

/**
 * Viser avatar som enten et rundt billede (URL) eller emoji i en cirkel.
 * Brug `style` til at sætte border, background mv. fra den kaldende komponent.
 * Sæt `clickable` når avataren bruges som klikbart element — det giver subtil
 * scale + accent-ring on hover, så brugeren kan se at det er interaktivt.
 */
export function AvatarCircle({ avatar, size = 48, emojiSize = '22px', alt = '', style = {}, clickable = false }) {
  return (
    <div
      className={clickable ? 'pm-avatar-circle pm-avatar-circle--clickable' : 'pm-avatar-circle'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {isAvatarUrl(avatar)
        ? <img src={avatar} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: emojiSize }}>{avatar || '🎾'}</span>
      }
    </div>
  );
}

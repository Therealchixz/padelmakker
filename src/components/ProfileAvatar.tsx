import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { isAvatarUrl } from '../lib/avatarUpload';

export type ProfileAvatarProps = {
  avatar?: string | null;
  size?: number;
  fontSize?: number;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'style' | 'alt'>;

/**
 * Viser enten emoji-avatar eller billede fra URL (profiles.avatar).
 */
export function ProfileAvatar({
  avatar,
  size = 48,
  fontSize,
  style,
  imgStyle,
  ...rest
}: ProfileAvatarProps) {
  const url = isAvatarUrl(avatar);
  const fs = fontSize ?? Math.round(size * 0.5);
  if (url) {
    return (
      <img
        src={avatar!}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          ...imgStyle,
          ...style,
        }}
        {...rest}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fs,
        flexShrink: 0,
        ...style,
      }}
    >
      {avatar || '🎾'}
    </div>
  );
}

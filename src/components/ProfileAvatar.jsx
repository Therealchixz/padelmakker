/**
 * Viser profiles.avatar: enten billede (http/https) eller emoji/tekst.
 */
export function ProfileAvatar({ value, size = 48, style = {}, imgStyle = {}, ...rest }) {
  const s = Number(size) || 48
  const v = value == null ? '' : String(value).trim()
  const isHttp = /^https?:\/\//i.test(v)

  if (isHttp) {
    return (
      <img
        src={v}
        alt=""
        {...rest}
        style={{
          width: s,
          height: s,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          ...style,
          ...imgStyle,
        }}
      />
    )
  }

  return (
    <div
      {...rest}
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(s * 0.45),
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {v || '🎾'}
    </div>
  )
}

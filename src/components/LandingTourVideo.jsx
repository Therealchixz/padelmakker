import { theme, font, heading } from '../lib/platformTheme'

const VIDEO_ID = (import.meta.env.VITE_LANDING_TOUR_VIDEO_ID || '').trim()

/**
 * YouTube-rundvisning på forsiden. Sæt VITE_LANDING_TOUR_VIDEO_ID (kun video-id, fx dQw4w9WgXcQ).
 * Uden id vises sektionen ikke.
 */
export function LandingTourVideo() {
  if (!VIDEO_ID) return null

  const embedSrc = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`

  return (
    <section
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 clamp(16px,4vw,24px) clamp(48px,10vw,72px)',
      }}
    >
      <div className="pm-reveal" style={{ textAlign: 'center', marginBottom: 'clamp(24px,5vw,32px)' }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          Se det i aktion
        </p>
        <h2 style={{ ...heading('clamp(24px,5vw,32px)'), letterSpacing: '-0.03em', margin: 0 }}>
          Rundvisning i PadelMakker
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: theme.textMid,
            lineHeight: 1.6,
            maxWidth: '520px',
            margin: '14px auto 0',
          }}
        >
          Kort gennemgang af appen — find makker, kampe, baner og mere.
        </p>
      </div>
      <div
        style={{
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowLg,
          background: '#0f172a',
          aspectRatio: '16 / 9',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <iframe
          title="Rundvisning i PadelMakker"
          src={embedSrc}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            fontFamily: font,
          }}
        />
      </div>
    </section>
  )
}

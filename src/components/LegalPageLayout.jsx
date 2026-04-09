import { useNavigate } from 'react-router-dom';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from './PublicLegalFooter';

/**
 * @param {{ title: string; children: import('react').ReactNode }} props
 */
export function LegalPageLayout({ title, children }) {
  const navigate = useNavigate();

  return (
    <div
      className="pm-legal-page"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        padding:
          'max(16px, env(safe-area-inset-top)) clamp(16px, 4vw, 28px) max(100px, calc(env(safe-area-inset-bottom) + 72px))',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{ ...btn(false), marginBottom: '24px', padding: '8px 14px', fontSize: '13px' }}
        >
          ← Til forsiden
        </button>
        <article
          style={{
            background: theme.surface,
            borderRadius: '14px',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            padding: 'clamp(24px, 5vw, 36px)',
          }}
        >
          <h1 style={{ ...heading('clamp(22px, 5vw, 28px)'), marginBottom: '20px', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          <div
            className="pm-legal-prose"
            style={{
              fontSize: '15px',
              lineHeight: 1.65,
              color: theme.textMid,
            }}
          >
            {children}
          </div>
        </article>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

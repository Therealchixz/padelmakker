import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from './PublicLegalFooter';
import { LEGAL_INFO } from '../lib/legalInfo';
import { useDarkMode } from '../lib/useDarkMode';

/**
 * @param {{
 *   title: string;
 *   children: import('react').ReactNode;
 *   showUpdated?: boolean;   // "Senest opdateret" giver kun mening på juridiske sider
 *   showSignupCta?: boolean; // "Opret gratis profil" nederst for besøgende, der ikke er logget ind
 * }} props
 */
export function LegalPageLayout({ title, children, showUpdated = true, showSignupCta = false }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [dark] = useDarkMode();
  const backPath = session ? '/dashboard/hjem' : '/';
  const backLabel = session ? '← Til dashboard' : '← Til forsiden';

  return (
    <div
      className="pm-legal-page pm-brand"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        padding:
          'max(20px, calc(env(safe-area-inset-top, 0px) + 12px)) clamp(16px, 4vw, 28px) max(100px, calc(env(safe-area-inset-bottom) + 72px))',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <Link to="/" aria-label="PadelMakker forsiden" style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>
            <picture>
              <source srcSet={dark ? '/logo-brand-dark-nav.webp' : '/logo-brand-nav.webp'} type="image/webp" />
              <img
                src={dark ? '/logo-brand-dark.png' : '/logo-brand.png'}
                width={320}
                height={120}
                alt="PadelMakker"
                style={{ height: '36px', width: 'auto', display: 'block' }}
              />
            </picture>
          </Link>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            style={{ ...btn(false), padding: '8px 14px', fontSize: '13px', minHeight: '44px' }}
          >
            {backLabel}
          </button>
        </div>
        <main>
        <article
          style={{
            background: theme.surface,
            borderRadius: '14px',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            padding: 'clamp(24px, 5vw, 36px)',
          }}
        >
          <h1 style={{ ...heading('clamp(22px, 5vw, 28px)'), marginBottom: '8px', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {showUpdated ? (
            <p style={{ fontSize: '13px', color: theme.textLight, margin: '0 0 20px' }}>
              Senest opdateret: {LEGAL_INFO.lastUpdated}
            </p>
          ) : (
            <div style={{ height: '12px' }} aria-hidden />
          )}
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
          {showSignupCta && !session ? (
            <div
              style={{
                marginTop: '28px',
                paddingTop: '24px',
                borderTop: `1px solid ${theme.border}`,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px 16px',
              }}
            >
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: theme.text }}>
                Klar til at finde din næste makker?
              </p>
              <button
                type="button"
                onClick={() => navigate('/opret')}
                style={{ ...btn(true), padding: '12px 20px', fontSize: '14px' }}
              >
                Opret gratis profil
              </button>
            </div>
          ) : null}
        </article>
        </main>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

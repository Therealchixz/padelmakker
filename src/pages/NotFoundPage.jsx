import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { useDarkMode } from '../lib/useDarkMode';
import { PadelRacketIcon } from '../components/PadelRacketIcon';

/**
 * 404 (impeccable-gennemgang 9. nov. 2026): logo, padel-ketsjeren i stedet for tennis-emojien,
 * Anton-overskrift og flere veje videre. Sider, der ikke findes, skal ikke i Googles indeks
 * (serveren svarer 200 til alle stier, så det klares med robots-meta).
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [dark] = useDarkMode();
  const homePath = session ? '/dashboard/hjem' : '/';
  const homeLabel = session ? 'Gå til dashboard' : 'Gå til forsiden';

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const linkStyle = {
    color: theme.text,
    fontWeight: 600,
    fontSize: '17px',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    minWidth: '44px',
    justifyContent: 'center',
    padding: '0 6px',
  };

  return (
    <div
      className="pm-root pm-brand"
      style={{
        fontFamily: font,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        color: theme.text,
        padding:
          'max(20px, calc(env(safe-area-inset-top, 0px) + 12px)) clamp(16px, 4vw, 28px) max(32px, calc(env(safe-area-inset-bottom) + 24px))',
      }}
    >
      <header style={{ width: '100%', maxWidth: '720px', margin: '0 auto' }}>
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
      </header>
      <main
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '32px 0',
        }}
      >
        <div style={{ maxWidth: '420px', width: '100%' }}>
          <PadelRacketIcon size={72} style={{ margin: '0 auto 20px', color: 'var(--pm-text)' }} />
          <h1 style={{ ...heading('clamp(34px, 9vw, 52px)'), margin: '0 0 12px' }}>Siden findes ikke</h1>
          <p style={{ fontSize: '17px', color: theme.textMid, margin: '0 0 28px', lineHeight: 1.55 }}>
            {session
              ? 'Linket findes ikke længere. Gå tilbage til dashboard og prøv igen.'
              : 'Det ser ud til at bolden er landet udenfor banen. Prøv at gå tilbage til forsiden.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(homePath)}
            style={{ ...btn(true), minHeight: '48px', padding: '0 28px', fontSize: '17px' }}
          >
            {homeLabel}
          </button>
          <nav aria-label="Andre sider" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 16px' }}>
            <Link to="/events" style={linkStyle}>Events</Link>
            <Link to="/faq" style={linkStyle}>FAQ</Link>
            <Link to="/hjaelp" style={linkStyle}>Hjælp</Link>
          </nav>
        </div>
      </main>
    </div>
  );
}

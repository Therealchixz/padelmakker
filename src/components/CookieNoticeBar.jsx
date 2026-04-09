import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { font, theme, btn } from '../lib/platformTheme';

const STORAGE_KEY = 'pm_cookie_notice_v1';

export function CookieNoticeBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Information om cookies"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        padding: 'max(12px, env(safe-area-inset-bottom)) clamp(12px, 3vw, 20px) max(14px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(240,244,248,0.92) 12%, rgba(255,255,255,0.98) 100%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          pointerEvents: 'auto',
          fontFamily: font,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          boxShadow: theme.shadowLg,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: theme.textMid }}>
          Vi bruger kun teknisk nødvendige lagring og cookies til login, sikker session og drift af PadelMakker. Vi sælger ikke
          dine data.{' '}
          <Link to="/cookies" style={{ color: theme.accent, fontWeight: 600 }}>
            Læs mere om cookies
          </Link>
          .
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={dismiss} style={{ ...btn(true), padding: '10px 18px', fontSize: '13px' }}>
            Forstået
          </button>
        </div>
      </div>
    </div>
  );
}

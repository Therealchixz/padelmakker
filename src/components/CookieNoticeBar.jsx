import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { font, theme, btn } from '../lib/platformTheme';

const STORAGE_KEY = 'pm_cookie_notice_v1';
// Højden deles som CSS-variabel, så fuldskærmsvinduer (fx Velkommen) kan holde
// deres nederste knap fri af baren.
const HEIGHT_VAR = '--pm-cookie-bar-h';

export function CookieNoticeBar() {
  const [visible, setVisible] = useState(false);
  // Paa forsiden venter linjen, til man ruller: den skal ikke ligge over "Opret gratis profil"
  // i foerste skaermbillede (paa de mindste telefoner ligger knappen helt nede).
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 40);
  const barRef = useRef(null);

  useEffect(() => {
    if (scrolled || pathname !== '/' || typeof window === 'undefined') return undefined;
    const onScroll = () => {
      if (window.scrollY > 40) setScrolled(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrolled, pathname]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const show = visible && (pathname !== '/' || scrolled);

  useEffect(() => {
    const el = barRef.current;
    if (!show || !el || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const update = () => root.style.setProperty(HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(HEIGHT_VAR);
    };
  }, [show]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };


  if (!show) return null;

  // Smal linje nederst (impeccable-gennemgang 9. nov. 2026): den gamle boks fyldte en fjerdedel
  // af telefonskærmen og dækkede "Opret gratis profil" ved første besøg.
  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Information om cookies"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        fontFamily: font,
        background: theme.surface,
        borderTop: `1px solid ${theme.border}`,
        boxShadow: theme.shadowLg,
        padding: '6px max(12px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <p style={{ margin: 0, flex: '1 1 auto', minWidth: 0, fontSize: '14px', lineHeight: 1.35, color: theme.textMid }}>
          Vi bruger kun nødvendige cookies.
        </p>
        <Link
          to="/cookies"
          style={{
            flex: '0 0 auto',
            color: theme.text,
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
          }}
        >
          Læs mere
        </Link>
        <button
          type="button"
          onClick={dismiss}
          style={{ ...btn(true), flex: '0 0 auto', minHeight: '44px', padding: '0 18px', fontSize: '14px' }}
        >
          Forstået
        </button>
      </div>
    </div>
  );
}

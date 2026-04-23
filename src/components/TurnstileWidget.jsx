import { useEffect, useRef, useState } from 'react';
import { font, theme } from '../lib/platformTheme';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScriptPromise = null;

function readTurnstileTheme() {
  if (typeof document === 'undefined') return 'light';
  const attrTheme = document.documentElement.getAttribute('data-theme');
  if (attrTheme === 'dark') return 'dark';
  if (attrTheme === 'light') return 'light';
  try {
    return localStorage.getItem('pm-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function ensureTurnstileScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile er ikke tilgængelig uden browser.'));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${TURNSTILE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile script kunne ikke indlæses.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Turnstile script kunne ikke indlæses.'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function TurnstileWidget({ siteKey, onTokenChange, resetNonce = 0 }) {
  const mountRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [turnstileTheme, setTurnstileTheme] = useState(() => readTurnstileTheme());

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const syncTheme = () => setTurnstileTheme(readTurnstileTheme());
    syncTheme();

    const observer = new MutationObserver(() => syncTheme());
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!siteKey) {
      onTokenChange('');
      return undefined;
    }

    let active = true;
    onTokenChange('');
    setLoadError('');

    void ensureTurnstileScript()
      .then(() => {
        if (!active || !mountRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(mountRef.current, {
          sitekey: siteKey,
          theme: turnstileTheme,
          callback: (token) => {
            if (active) onTokenChange(token || '');
          },
          'expired-callback': () => {
            if (active) onTokenChange('');
          },
          'error-callback': () => {
            if (!active) return;
            onTokenChange('');
            setLoadError('Captcha kunne ikke valideres. Prøv igen.');
          },
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChange('');
        setLoadError('Captcha kunne ikke indlæses. Genindlæs siden og prøv igen.');
      });

    return () => {
      active = false;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onTokenChange, turnstileTheme]);

  useEffect(() => {
    if (!siteKey || widgetIdRef.current == null || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    onTokenChange('');
  }, [resetNonce, siteKey, onTokenChange]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={mountRef} />
      {loadError && (
        <p style={{ marginTop: '8px', fontSize: '12px', color: theme.red, fontFamily: font }}>
          {loadError}
        </p>
      )}
    </div>
  );
}

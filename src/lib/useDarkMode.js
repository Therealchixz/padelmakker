import { useState, useEffect, useRef } from 'react';
import { syncThemeColorWithTheme } from './themeColor';

/** Har besøgende selv valgt lys/mørk? Ellers følger vi telefonens/computerens indstilling. */
function readStoredTheme() {
  try {
    const t = localStorage.getItem('pm-theme');
    return t === 'dark' || t === 'light' ? t : null;
  } catch (e) {
    console.warn('[theme] read localStorage failed:', e);
    return null;
  }
}

function systemPrefersDark() {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  } catch {
    return false;
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = readStoredTheme();
    return stored ? stored === 'dark' : systemPrefersDark();
  });
  // Gem kun valget, når brugeren selv har skiftet. Så følger siden enhedens indstilling indtil da.
  const hadStoredChoice = useRef(readStoredTheme() !== null);
  const firstRun = useRef(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // Forsiden har sin egen faste moerke farve; den saetter den selv.
    if (!document.querySelector('.pm-lp')) syncThemeColorWithTheme();
    if (firstRun.current) {
      firstRun.current = false;
      if (!hadStoredChoice.current) return;
    }
    try { localStorage.setItem('pm-theme', dark ? 'dark' : 'light'); } catch (e) { console.warn('[theme] write localStorage failed:', e); }
  }, [dark]);

  return [dark, setDark];
}

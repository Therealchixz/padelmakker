import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('pm-theme') === 'dark'; } catch (e) { console.warn('[theme] read localStorage failed:', e); return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('pm-theme', dark ? 'dark' : 'light'); } catch (e) { console.warn('[theme] write localStorage failed:', e); }
  }, [dark]);

  return [dark, setDark];
}

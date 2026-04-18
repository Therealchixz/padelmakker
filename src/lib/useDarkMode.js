import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('pm-theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('pm-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  return [dark, setDark];
}

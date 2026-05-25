import { useEffect, useState } from 'react';

/** Polling-intervaller kun mens fanen/PWA er synlig (sparer batteri på mobil). */
export const BADGE_POLL_VISIBLE_MS = 45_000;
export const NOTIF_BELL_POLL_VISIBLE_MS = 60_000;
export const MATCH_CHAT_POLL_VISIBLE_MS = 20_000;

export function isPageVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** Re-render når brugeren skifter fane / minimerer PWA (til pause af realtime/polling). */
export function usePageVisible() {
  const [visible, setVisible] = useState(isPageVisible);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onChange = () => setVisible(isPageVisible());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}

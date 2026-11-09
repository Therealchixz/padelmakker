import { useEffect, useRef } from 'react';

/**
 * Telefonens tilbage (Android-knappen, swipe i iOS-appen, browserens pil) lukker et
 * ark eller vindue i stedet for at forlade siden under det.
 *
 * Naar vinduet aabnes, laegges et skridt i historikken (samme adresse, med en markering).
 * Tilbage fjerner skridtet, og vinduet lukker. Lukkes vinduet med en knap, fjerner vi
 * selv skridtet igen, saa historikken ikke vokser.
 *
 * Vi arbejder direkte paa window.history, fordi routeren kan opdatere sin adresse en
 * gengivelse senere end vinduet lukker. Skifter et valg i vinduet side (navigate), er
 * historikkens oeverste skridt allerede et andet, og saa lader vi det vaere.
 *
 * @param {boolean} open
 * @param {(() => void) | undefined} onClose
 * @param {string} key  unikt navn for vinduet, fx "spil"
 */
export function useCloseOnBack(open, onClose, key) {
  const active = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const onPop = () => {
      if (!active.current || window.history.state?.pmOverlay === key) return;
      active.current = false;
      onCloseRef.current?.();
    };
    // Skridtet laegges lige efter, saa en hurtig aabn-luk (Reacts dobbelte start under udvikling)
    // ikke efterlader eller fjerner et skridt for meget.
    const timer = window.setTimeout(() => {
      const h = window.history;
      h.pushState({ ...(h.state || {}), pmOverlay: key }, '', window.location.href);
      active.current = true;
      window.addEventListener('popstate', onPop);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      if (!active.current) return;
      active.current = false;
      // Lukket med en knap eller fjernet fra siden: fjern vores skridt, hvis vi stadig staar paa det.
      if (window.history.state?.pmOverlay === key) window.history.back();
    };
  }, [open, key]);
}

/** Staar vi lige nu paa et skridt, som et aabent vindue har lagt i historikken? */
export function isOnOverlayHistoryEntry() {
  return typeof window !== 'undefined' && Boolean(window.history.state?.pmOverlay);
}

import { useEffect, useRef } from 'react';
import { normalizeStringArrayField } from './profileUtils';

/** Sikker liste til .map() selv hvis profil kommer uden normalisering */
export function availabilityTags(profileLike) {
  return normalizeStringArrayField(profileLike?.availability);
}

export function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function resolveDisplayName(profileRow, authUser) {
  const bad = (s) => {
    if (s == null || String(s).trim() === '') return true;
    const t = String(s).trim().toLowerCase();
    return t === 'ny spiller' || t === 'ny';
  };
  const fromProfile = profileRow?.full_name || profileRow?.name;
  if (fromProfile && !bad(fromProfile)) return String(fromProfile).trim();
  const meta = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name;
  if (meta && !bad(meta)) return String(meta).trim();
  return authUser?.email?.split('@')[0] || 'Spiller';
}

/* ─── Scroll reveal hook ─── */
export function useScrollReveal() {
  const containerRef = useRef(null);
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const els = root.querySelectorAll('.pm-reveal, .pm-reveal-left, .pm-reveal-right, .pm-reveal-scale');
    if (!els.length) return;
    const revealAll = () => els.forEach((el) => el.classList.add('pm-visible'));

    if (typeof IntersectionObserver === 'undefined') {
      revealAll();
      return undefined;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting || e.intersectionRatio > 0) {
          e.target.classList.add('pm-visible');
          io.unobserve(e.target);
        }
      });
    }, {
      threshold: 0.01,
      rootMargin: '0px 0px -6% 0px',
    });

    els.forEach((el) => io.observe(el));

    // Safety net: never keep content hidden if observer callbacks are delayed.
    const failSafeTimer = window.setTimeout(revealAll, 900);

    return () => {
      window.clearTimeout(failSafeTimer);
      io.disconnect();
    };
  }, []);
  return containerRef;
}

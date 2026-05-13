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
    const selector = '.pm-reveal, .pm-reveal-left, .pm-reveal-right, .pm-reveal-scale';

    const revealElement = (el) => {
      if (!el || !(el instanceof Element)) return;
      el.classList.add('pm-visible');
    };

    const revealAll = () => {
      root.querySelectorAll(selector).forEach(revealElement);
    };

    if (typeof IntersectionObserver === 'undefined') {
      revealAll();
      return undefined;
    }

    const observed = new WeakSet();
    const isLikelyInViewport = (el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      return rect.bottom >= 0 && rect.top <= vh;
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          revealElement(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.01,
      rootMargin: '0px 0px -6% 0px',
    });

    const registerElement = (el) => {
      if (!el || !(el instanceof Element)) return;
      if (el.classList.contains('pm-visible')) return;
      if (observed.has(el)) return;

      if (isLikelyInViewport(el)) {
        revealElement(el);
        return;
      }

      observed.add(el);
      io.observe(el);
    };

    const registerTree = (node) => {
      if (!node || !(node instanceof Element)) return;
      if (node.matches(selector)) registerElement(node);
      node.querySelectorAll(selector).forEach(registerElement);
    };

    registerTree(root);

    const mo = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((addedNode) => registerTree(addedNode));
          });
        });

    if (mo) {
      mo.observe(root, { childList: true, subtree: true });
    }

    // Safety net: never keep reveal elements hidden if observer callbacks are delayed.
    const failSafeTimer = window.setTimeout(revealAll, 1200);

    return () => {
      window.clearTimeout(failSafeTimer);
      if (mo) mo.disconnect();
      io.disconnect();
    };
  }, []);
  return containerRef;
}

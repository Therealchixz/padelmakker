import { useEffect } from 'react';

/**
 * Scrolls a ref into view when `active` becomes true (e.g. opret-formular åbnes).
 */
export function useScrollIntoViewWhen(active, ref, { block = 'start', delayMs = 120, enabled = true } = {}) {
  useEffect(() => {
    if (!active || !enabled) return undefined;
    const id = window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block });
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [active, enabled, block, delayMs, ref]);
}

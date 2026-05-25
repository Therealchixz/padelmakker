/** Matcher Tailwind md-breakpoint (768px) — bruges til guided tour på mobil. */
export function detectIsMobileView() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 768px)').matches;
  }
  return window.innerWidth <= 768;
}

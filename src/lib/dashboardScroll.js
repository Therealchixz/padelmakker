/** Minimum scroll før re-tap på aktiv fane scroller til top (mobil). */
export const DASHBOARD_SCROLL_TOP_THRESHOLD = 48;

export function getDashboardScrollTop() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY ?? document.documentElement.scrollTop ?? 0;
}

export function scrollDashboardToTop(behavior = 'smooth') {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior });
}

export function shouldScrollDashboardToTopOnTabReselect(
  scrollTop = getDashboardScrollTop(),
  threshold = DASHBOARD_SCROLL_TOP_THRESHOLD,
) {
  return scrollTop > threshold;
}

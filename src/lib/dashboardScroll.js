/** Minimum scroll før re-tap på aktiv fane scroller til top (mobil). */
export const DASHBOARD_SCROLL_TOP_THRESHOLD = 48;

function getDashboardMainScrollEl() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.pm-dash-main');
}

export function getDashboardScrollTop() {
  if (typeof window === 'undefined') return 0;
  const main = getDashboardMainScrollEl();
  if (main && main.scrollHeight > main.clientHeight + 1) {
    return main.scrollTop;
  }
  return window.scrollY ?? document.documentElement.scrollTop ?? 0;
}

export function scrollDashboardToTop(behavior = 'smooth') {
  if (typeof window === 'undefined') return;
  const main = getDashboardMainScrollEl();
  if (main) {
    main.scrollTo({ top: 0, left: 0, behavior });
  }
  window.scrollTo({ top: 0, left: 0, behavior });
}

export function shouldScrollDashboardToTopOnTabReselect(
  scrollTop = getDashboardScrollTop(),
  threshold = DASHBOARD_SCROLL_TOP_THRESHOLD,
) {
  return scrollTop > threshold;
}

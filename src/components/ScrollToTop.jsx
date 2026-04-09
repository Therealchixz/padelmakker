import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Ruller vinduet til top ved navigation (SPA bevarer ellers scroll mellem sider). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

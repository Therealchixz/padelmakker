const STORAGE_KEY = 'pm_auth_return_to_v1';

/** @param {string | null | undefined} raw */
export function sanitizeAuthReturnPath(raw) {
  const path = String(raw || '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (/^\/kamp\/[0-9a-f-]{36}$/i.test(path)) return path;
  if (/^\/turnering\/[0-9a-f-]{36}$/i.test(path)) return path;
  if (/^\/dashboard\/kampe(\/|$)/.test(path)) return path.split('?')[0];
  return null;
}

/** @param {string | null | undefined} returnPath */
export function authReturnSignupUrl(returnPath) {
  const safe = sanitizeAuthReturnPath(returnPath);
  if (!safe) return '/opret';
  return `/opret?next=${encodeURIComponent(safe)}`;
}

/** @param {string | null | undefined} path */
export function persistAuthReturnPath(path) {
  const safe = sanitizeAuthReturnPath(path);
  if (!safe || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* ignore */
  }
}

/** @param {string | undefined} [search] URL search string (e.g. location.search). Omit to use window.location.search. */
export function readAuthReturnFromSearch(search) {
  const resolved = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!resolved) return;
  const params = new URLSearchParams(resolved.startsWith('?') ? resolved : `?${resolved}`);
  const next = params.get('next');
  if (next) persistAuthReturnPath(next);
}

/** @returns {string | null} */
export function peekAuthReturnPath() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sanitizeAuthReturnPath(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** @returns {string | null} */
export function consumeAuthReturnPath() {
  const path = peekAuthReturnPath();
  if (!path || typeof sessionStorage === 'undefined') return null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return path;
}

/** @param {string} publicOrDashboardPath */
export function mapAuthReturnToDashboardPath(publicOrDashboardPath) {
  const path = sanitizeAuthReturnPath(publicOrDashboardPath);
  if (!path) return '/dashboard/hjem';
  const match = /^\/kamp\/([0-9a-f-]{36})$/i.exec(path);
  if (match) return `/dashboard/kampe/2v2/${match[1]}`;
  const tournament = /^\/turnering\/([0-9a-f-]{36})$/i.exec(path);
  if (tournament) return `/dashboard/kampe/americano/${tournament[1]}`;
  return path;
}

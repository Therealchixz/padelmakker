import {
  parseKampeFocusFromSearch,
  KAMPE_FORMAT_PADEL,
  KAMPE_FORMAT_AMERICANO,
  KAMPE_FORMAT_LIGA,
  normalizeKampeFormat,
} from './kampeFocusNavigation.js';

export { KAMPE_FORMAT_PADEL, KAMPE_FORMAT_AMERICANO, KAMPE_FORMAT_LIGA };

const DASHBOARD_TABS = new Set([
  'hjem',
  'makkere',
  'baner',
  'kampe',
  'ranking',
  'liga',
  'beskeder',
  'profil',
  'kamp-filter',
  'makker-filter',
  'admin',
  'notifikationer',
]);

/** @typedef {'schedule' | { team: string }} KampeLigaSubRoute */
/** @typedef {{ kind: '2v2' | 'americano' | 'liga', format: string, id: string, sub?: KampeLigaSubRoute }} KampeDetailRoute */

/**
 * @param {string} pathname
 * @returns {string}
 */
export function parseDashboardTab(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts[0] !== 'dashboard') return 'hjem';
  const segment = parts[1] || 'hjem';
  if (segment === 'kampe') return 'kampe';
  return DASHBOARD_TABS.has(segment) ? segment : 'hjem';
}

/**
 * @param {string} pathname
 * @returns {KampeDetailRoute | null}
 */
export function parseKampeDetailRoute(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts[0] !== 'dashboard' || parts[1] !== 'kampe') return null;
  const kind = parts[2];
  const id = parts[3] ? String(parts[3]) : null;
  if (!id) return null;
  if (kind === '2v2') {
    return { kind: '2v2', format: KAMPE_FORMAT_PADEL, id };
  }
  if (kind === 'americano') {
    return { kind: 'americano', format: KAMPE_FORMAT_AMERICANO, id };
  }
  if (kind === 'liga') {
    /** @type {KampeDetailRoute} */
    const route = { kind: 'liga', format: KAMPE_FORMAT_LIGA, id };
    if (parts[4] === 'schedule') route.sub = 'schedule';
    else if (parts[4] === 'hold' && parts[5]) route.sub = { team: String(parts[5]) };
    return route;
  }
  return null;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isKampeDetailRoute(pathname) {
  return parseKampeDetailRoute(pathname) != null;
}

/**
 * @param {string} matchId
 * @param {{ openChat?: boolean }} [opts]
 * @returns {string}
 */
export function buildKampe2v2DetailPath(matchId, { openChat = false } = {}) {
  const base = `/dashboard/kampe/2v2/${encodeURIComponent(String(matchId))}`;
  return openChat ? `${base}?chat=1` : base;
}

/**
 * @param {string} tournamentId
 * @param {{ openChat?: boolean }} [opts]
 * @returns {string}
 */
export function buildKampeAmericanoDetailPath(tournamentId, { openChat = false } = {}) {
  const base = `/dashboard/kampe/americano/${encodeURIComponent(String(tournamentId))}`;
  return openChat ? `${base}?chat=1` : base;
}

/**
 * @param {string} leagueId
 * @param {{ openChat?: boolean }} [opts]
 * @returns {string}
 */
export function buildKampeLigaDetailPath(leagueId, { openChat = false } = {}) {
  const base = `/dashboard/kampe/liga/${encodeURIComponent(String(leagueId))}`;
  return openChat ? `${base}?chat=1` : base;
}

/**
 * @param {string} leagueId
 * @returns {string}
 */
export function buildKampeLigaSchedulePath(leagueId) {
  return `${buildKampeLigaDetailPath(leagueId)}/schedule`;
}

/**
 * @param {string} leagueId
 * @param {string} teamId
 * @returns {string}
 */
export function buildKampeLigaTeamPath(leagueId, teamId) {
  return `${buildKampeLigaDetailPath(leagueId)}/hold/${encodeURIComponent(String(teamId))}`;
}

/**
 * @param {string} format
 * @param {string} focusId
 * @param {{ openChat?: boolean }} [opts]
 * @returns {string}
 */
export function buildKampeDetailPathFromFormat(format, focusId, { openChat = false } = {}) {
  const f = normalizeKampeFormat(format);
  if (f === KAMPE_FORMAT_AMERICANO) {
    return buildKampeAmericanoDetailPath(focusId, { openChat });
  }
  if (f === KAMPE_FORMAT_LIGA) {
    return buildKampeLigaDetailPath(focusId, { openChat });
  }
  return buildKampe2v2DetailPath(focusId, { openChat });
}

/**
 * @param {string} [hash]
 * @returns {string | null}
 */
export function parseLegacyKampeMatchHash(hash) {
  const m = /^#pm-match-(.+)$/.exec(String(hash || ''));
  return m ? String(m[1]) : null;
}

/**
 * @param {string} [hash]
 * @returns {string | null}
 */
export function parseLegacyAmericanoHash(hash) {
  const m = /^#pm-americano-(.+)$/.exec(String(hash || ''));
  return m ? String(m[1]) : null;
}

/**
 * Legacy ?focus=, ?format=&focus= og #pm-match- / #pm-americano- → nye detail-ruter.
 * @param {string} pathname
 * @param {string} search
 * @param {string} hash
 * @returns {string | null}
 */
export function resolveLegacyKampeFocusRedirect(pathname, search, hash) {
  if (parseKampeDetailRoute(pathname)) return null;

  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts[0] !== 'dashboard' || parts[1] !== 'kampe') return null;

  const hashMatchId = parseLegacyKampeMatchHash(hash);
  if (hashMatchId) return buildKampe2v2DetailPath(hashMatchId);

  const hashAmericanoId = parseLegacyAmericanoHash(hash);
  if (hashAmericanoId) return buildKampeAmericanoDetailPath(hashAmericanoId);

  const { format, focusId, openChat } = parseKampeFocusFromSearch(search);
  if (focusId) return buildKampeDetailPathFromFormat(format, focusId, { openChat });

  return null;
}

/**
 * @param {string} format
 * @returns {string}
 */
export function buildKampeListPath(format) {
  const f = normalizeKampeFormat(format);
  if (f === KAMPE_FORMAT_PADEL) return '/dashboard/kampe';
  return `/dashboard/kampe?format=${f}`;
}

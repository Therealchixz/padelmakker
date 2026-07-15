import { TOURNAMENT_KAMPE_TAB_LABEL } from './tournamentCopy.js';

/** Kampe-formatter som understøtter ?format= & ?focus= deep links fra notifikationer. */
export const KAMPE_FORMAT_PADEL = 'padel';
export const KAMPE_FORMAT_AMERICANO = 'americano';
export const KAMPE_FORMAT_LIGA = 'liga';

const VALID_FORMATS = new Set([KAMPE_FORMAT_PADEL, KAMPE_FORMAT_AMERICANO, KAMPE_FORMAT_LIGA]);

export function normalizeKampeFormat(raw) {
  const f = String(raw || KAMPE_FORMAT_PADEL).toLowerCase();
  return VALID_FORMATS.has(f) ? f : KAMPE_FORMAT_PADEL;
}

export function parseKampeFocusFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return {
    format: normalizeKampeFormat(params.get('format')),
    focusId: params.get('focus') ? String(params.get('focus')) : null,
    openChat: params.get('chat') === '1',
  };
}

export { buildKampeDetailPathFromFormat as buildKampeFocusPath } from './kampeDetailRoutes.js';

export function kampeFocusOpensChat(notifType) {
  const type = String(notifType || '').toLowerCase();
  return type === 'match_chat' || type === 'match_chat_group';
}

/** Hvor en notifikation skal åbne i Kampe (eller null hvis ikke klikbar). */
export function notificationKampeTarget(notif) {
  if (!notif) return null;
  const entityType = String(notif.entity_type || '').toLowerCase();
  const entityId = notif.entity_id ? String(notif.entity_id) : null;
  if (entityType === KAMPE_FORMAT_AMERICANO && entityId) {
    return { format: KAMPE_FORMAT_AMERICANO, focusId: entityId };
  }
  // Liga-notifikationer gemmes med entity_type 'league' (og enkelte 'liga')
  if ((entityType === KAMPE_FORMAT_LIGA || entityType === 'league') && entityId) {
    return { format: KAMPE_FORMAT_LIGA, focusId: entityId };
  }
  if (notif.match_id) {
    return { format: KAMPE_FORMAT_PADEL, focusId: String(notif.match_id) };
  }
  return null;
}

export function kampeFocusFooterLabel(format, notifType) {
  const type = String(notifType || '').toLowerCase();
  if (format === KAMPE_FORMAT_AMERICANO) {
    if (type === 'americano_completed') return `Tryk for at åbne ${TOURNAMENT_KAMPE_TAB_LABEL} → Afsluttede →`;
    if (type === 'americano_started') return `Tryk for at åbne ${TOURNAMENT_KAMPE_TAB_LABEL} → I gang →`;
    if (type === 'americano_cancelled') return `Tryk for at åbne ${TOURNAMENT_KAMPE_TAB_LABEL} → Åbne →`;
    return `Tryk for at åbne ${TOURNAMENT_KAMPE_TAB_LABEL} → Åbne →`;
  }
  if (format === KAMPE_FORMAT_LIGA) {
    if (type === 'league_completed') return 'Tryk for at åbne Liga → Afsluttede →';
    if (type === 'league_started') return 'Tryk for at åbne Liga → I gang →';
    return 'Tryk for at åbne Liga → Åbne →';
  }
  if (kampeFocusOpensChat(type)) return 'Tryk for at åbne chatten →';
  return 'Tryk for at gå til kampen →';
}

import {
  KAMPE_CHAT_NOTIFICATION_TYPE,
  KAMPE_NON_CHAT_NOTIFICATION_TYPES,
} from './kampeNotificationTypes.js';

export function groupUnreadNotificationsByMatchId(rows) {
  const grouped = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const matchId = row?.match_id ? String(row.match_id) : '';
    if (!matchId) return;
    grouped[matchId] = (grouped[matchId] || 0) + 1;
  });
  return grouped;
}

function normalizeMatchStatus(status) {
  return (status ?? 'open').toString().toLowerCase();
}

export function isKampeNotificationRelevantForStatus(type, status) {
  const normalizedStatus = normalizeMatchStatus(status);
  if (type === KAMPE_CHAT_NOTIFICATION_TYPE) return true;

  if (normalizedStatus === 'open' || normalizedStatus === 'full') {
    return [
      'match_join',
      'match_invite',
      'match_full',
      'match_cancelled',
      'seeking_player',
    ].includes(type);
  }

  if (normalizedStatus === 'in_progress') {
    return [
      'result_submitted',
      'match_cancelled',
    ].includes(type);
  }

  if (normalizedStatus === 'completed') {
    return type === 'result_confirmed';
  }

  return false;
}

export function groupRelevantUnreadNotificationsByMatchId(rows, statusByMatchId = {}) {
  const grouped = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const matchId = row?.match_id ? String(row.match_id) : '';
    if (!matchId) return;
    if (!isKampeNotificationRelevantForStatus(row?.type, statusByMatchId[matchId])) return;
    grouped[matchId] = (grouped[matchId] || 0) + 1;
  });
  return grouped;
}

export function countRelevantKampeUnreadNotifications(rows, statusByMatchId = {}) {
  return Object.values(groupRelevantUnreadNotificationsByMatchId(rows, statusByMatchId))
    .reduce((sum, count) => sum + count, 0);
}

export function removeUnreadForMatch(previous, matchId) {
  const key = String(matchId || '');
  if (!key || !previous?.[key]) return previous;
  const next = { ...previous };
  delete next[key];
  return next;
}

export function shouldRefreshKampeUnreadForNotificationType(type) {
  if (type === KAMPE_CHAT_NOTIFICATION_TYPE) return 'chat';
  if (KAMPE_NON_CHAT_NOTIFICATION_TYPES.includes(type)) return 'match';
  return null;
}

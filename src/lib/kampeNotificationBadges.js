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

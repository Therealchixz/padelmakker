export const KAMPE_CHAT_NOTIFICATION_TYPE = 'match_chat';

export const KAMPE_NON_CHAT_NOTIFICATION_TYPES = Object.freeze([
  'match_join',
  'match_invite',
  'match_full',
  'match_cancelled',
  'result_submitted',
  'result_confirmed',
  'seeking_player',
]);

export const KAMPE_NOTIFICATION_TYPES = Object.freeze([
  KAMPE_CHAT_NOTIFICATION_TYPE,
  ...KAMPE_NON_CHAT_NOTIFICATION_TYPES,
]);

export function isKampeNotificationType(type) {
  return KAMPE_NOTIFICATION_TYPES.includes(type);
}

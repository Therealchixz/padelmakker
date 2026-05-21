export const KAMPE_CHAT_NOTIFICATION_TYPE = 'match_chat';

export const KAMPE_NON_CHAT_NOTIFICATION_TYPES = Object.freeze([
  'match_join',
  'match_invite',
  'match_full',
  'match_cancelled',
  'result_submitted',
  'result_confirmed',
  'seeking_player',
  'match_watch_match',
]);

/** Americano/liga + holdinvitationer (entity_type + entity_id). */
export const KAMPE_ENTITY_NOTIFICATION_TYPES = Object.freeze([
  'americano_invite',
  'americano_full',
  'americano_started',
  'americano_completed',
  'americano_spot_open',
  'league_full',
  'league_started',
  'league_completed',
  'team_invite',
  'team_invite_accepted',
  'team_invite_declined',
]);

export const KAMPE_NOTIFICATION_TYPES = Object.freeze([
  KAMPE_CHAT_NOTIFICATION_TYPE,
  ...KAMPE_NON_CHAT_NOTIFICATION_TYPES,
  ...KAMPE_ENTITY_NOTIFICATION_TYPES,
]);

export function isKampeNotificationType(type) {
  return KAMPE_NOTIFICATION_TYPES.includes(type);
}

export function isKampeEntityNotificationType(type) {
  return KAMPE_ENTITY_NOTIFICATION_TYPES.includes(type);
}

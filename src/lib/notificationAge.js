import { isActionableProposalNotification } from './playIntentUtils.js';

/**
 * Alder på en notifikation i hele ord: "3 uger" i stedet for "3u".
 * @param {string | number | Date} date
 * @param {number} [now]
 */
export function formatNotificationAge(date, now = Date.now()) {
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'nu';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} t`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'I går';
  if (days < 7) return `${days} dage`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 uge' : `${weeks} uger`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? '1 måned' : `${months} måneder`;
}

/**
 * Et kampforslag skal bekræftes inden for højst 24 timer (se
 * play_intent_pool.sql). Er beskeden ældre, er fristen med sikkerhed udløbet.
 */
export const PROPOSAL_MAX_RESPONSE_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ type?: string, created_at?: string }} n
 * @param {number} [now]
 */
export function isExpiredActionNotification(n, now = Date.now()) {
  if (!n || !isActionableProposalNotification(n.type)) return false;
  const created = new Date(n.created_at).getTime();
  return Number.isFinite(created) && now - created > PROPOSAL_MAX_RESPONSE_MS;
}

/**
 * Udløbne opgaver skal ikke stå som ulæste: returnerer id'erne der skal
 * markeres læst, og listen med dem markeret.
 * @param {Array<{ id: string, read?: boolean, type?: string, created_at?: string }>} rows
 * @param {number} [now]
 */
export function settleExpiredNotifications(rows, now = Date.now()) {
  const ids = [];
  const next = (rows || []).map((n) => {
    if (!n.read && isExpiredActionNotification(n, now)) {
      ids.push(n.id);
      return { ...n, read: true };
    }
    return n;
  });
  return { rows: next, expiredIds: ids };
}

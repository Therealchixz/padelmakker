export const MAX_BATCH_NOTIFICATION_RECIPIENTS = 50;

/** @param {unknown} userIds */
export function normalizeNotificationRecipientIds(userIds) {
  const out = [];
  const seen = new Set();
  for (const raw of userIds || []) {
    const id = raw != null ? String(raw).trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, MAX_BATCH_NOTIFICATION_RECIPIENTS);
}

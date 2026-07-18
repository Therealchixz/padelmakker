/**
 * Fælles localStorage for afviste notifikationer (klokke + /notifikationer).
 */

export const NOTIF_DISMISSED_MAX = 400;
export const NOTIFICATIONS_SYNC_EVENT = 'pm-notifications-sync';

export function dismissedStorageKey(userId) {
  return `pm_notif_dismissed_${userId}`;
}

export function loadDismissedIds(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(dismissedStorageKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function addDismissedIds(userId, ids) {
  if (!userId || !ids?.length) return;
  const s = loadDismissedIds(userId);
  for (const id of ids) s.add(id);
  const arr = [...s];
  const trimmed = arr.length > NOTIF_DISMISSED_MAX ? arr.slice(-NOTIF_DISMISSED_MAX) : arr;
  try {
    localStorage.setItem(dismissedStorageKey(userId), JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}

export function emitNotificationsSync() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_SYNC_EVENT));
}

/**
 * Slet notifikationer i DB. Returnerer slettede id'er (kun ved succes).
 * @returns {Promise<string[]>}
 */
export async function deleteNotificationsForUser(supabase, userId, ids) {
  if (!userId || !ids?.length) return [];
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .in('id', ids)
    .eq('user_id', userId)
    .select('id');
  if (error || !data?.length) {
    console.warn(
      'notifications delete:',
      error?.message || error || 'ingen række slettet',
    );
    return [];
  }
  const deleted = data.map((r) => String(r.id));
  addDismissedIds(userId, deleted);
  emitNotificationsSync();
  return deleted;
}

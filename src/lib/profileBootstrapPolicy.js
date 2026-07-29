/**
 * Pure policy for profile bootstrap — no I/O.
 * Only a confirmed missing row may trigger create/upsert.
 * @param {'ok' | 'missing' | 'error' | 'timeout' | string} status
 * @returns {boolean}
 */
export function shouldCreateProfileOnFetchStatus(status) {
  return status === 'missing';
}

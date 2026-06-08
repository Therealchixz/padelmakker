/**
 * Toggle-logik for Seneste aktivitet-filtre på Hjem.
 * @param {Set<string>} activeIds
 * @param {string} id
 * @param {string[]} allFilterIds
 */
export function toggleHomeFeedFilter(activeIds, id, allFilterIds) {
  const prev = activeIds instanceof Set ? activeIds : new Set(activeIds || []);
  const allSelected = prev.size === allFilterIds.length;

  if (allSelected) {
    return new Set([id]);
  }
  if (prev.has(id)) {
    const next = new Set(prev);
    next.delete(id);
    return next;
  }
  const next = new Set(prev);
  next.add(id);
  return next;
}

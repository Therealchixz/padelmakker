/**
 * Sanitize user input before embedding in PostgREST .or() / .ilike filters.
 * Strips characters that break filter syntax or widen matches unexpectedly.
 */
export function sanitizePostgrestIlikePattern(input) {
  return String(input || '')
    .replace(/[%_,().\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Returns a safe `.or(...)` filter for profile name search, or null if too short. */
export function buildProfileNameSearchOrFilter(query) {
  const q = sanitizePostgrestIlikePattern(query);
  if (!q || q.length < 2) return null;
  return `full_name.ilike.%${q}%,name.ilike.%${q}%`;
}

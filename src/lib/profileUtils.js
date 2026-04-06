/**
 * Supabase/Postgres kan returnere text[] som JSON-array eller som streng afhængigt af klient/driver.
 * React forventer altid et array til .map() — ellers kastes der og ErrorBoundary vises.
 */
export function normalizeProfileRow(p) {
  if (p == null || typeof p !== 'object') return p
  let a = p.availability
  if (Array.isArray(a)) return p
  if (a == null) return { ...p, availability: [] }
  if (typeof a === 'string') {
    try {
      const j = JSON.parse(a)
      return { ...p, availability: Array.isArray(j) ? j : [] }
    } catch {
      return { ...p, availability: [] }
    }
  }
  return { ...p, availability: [] }
}

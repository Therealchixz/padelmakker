import { Court } from '../api/base44Client'

const TTL_MS = 10 * 60 * 1000

let cachedRows = null
let cachedAt = 0
let inflight = null

/** Hent baner med modul-cache — undgår fuld `courts`-select ved hver feed-refresh. */
export async function fetchCourtsCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedRows && now - cachedAt < TTL_MS) {
    return cachedRows
  }
  if (inflight) return inflight

  inflight = Court.filter()
    .then((rows) => {
      cachedRows = rows || []
      cachedAt = Date.now()
      return cachedRows
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function invalidateCourtsCache() {
  cachedRows = null
  cachedAt = 0
}

import { BANER_VENUES } from './banerVenues'

/** Værdi i <select> når center ikke har matchende række i `courts` endnu */
export const PM_VENUE_PREFIX = 'pm_venue:'

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

/**
 * Samme steder som under fanen Baner (Skansen, Padel Lounge, PadelPadel).
 * Matcher mod `courts` fra DB når muligt (uuid som value), ellers virtuelt id + null court_id.
 */
export function getMatchVenueOptions(courtsFromDb = []) {
  return BANER_VENUES.map((v) => {
    const t = norm(v.title)
    const match = (courtsFromDb || []).find((c) => {
      const n = norm(c.name)
      if (!n) return false
      if (n === t || n.includes(t) || t.includes(n)) return true
      if (v.id === 'match_padel_halbooking' && (n.includes('match') || n.includes('padel')))
        return n.includes('match') && n.includes('padel')
      return false
    })
    if (match) {
      return { id: match.id, label: v.title, courtId: match.id }
    }
    return { id: `${PM_VENUE_PREFIX}${v.id}`, label: v.title, courtId: null }
  })
}

export function courtIdFromVenueSelection(selectedId, options) {
  const o = (options || []).find((x) => x.id === selectedId)
  return o?.courtId ?? null
}

export function courtNameFromVenueSelection(selectedId, options) {
  const o = (options || []).find((x) => x.id === selectedId)
  return o?.label ?? ''
}

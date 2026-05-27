import { BANER_VENUES, groupBanerVenuesByRegion } from './banerVenues.js'

/** Værdi i <select> når center ikke har matchende række i `courts` endnu */
export const PM_VENUE_PREFIX = 'pm_venue:'

/** Opret kamp uden booket bane endnu — ingen specifikt center påkrævet */
export const MATCH_VENUE_TBD = '__venue_tbd__'

/** Turnering: bane ikke valgt / anden bane */
export const AMERICANO_VENUE_NONE = '__none'

const SPECIAL_VENUE_OPTION_IDS = new Set([MATCH_VENUE_TBD, AMERICANO_VENUE_NONE])

export function isSpecialVenueOption(id) {
  return SPECIAL_VENUE_OPTION_IDS.has(String(id || ''))
}

/**
 * Gruppér flade venue-options (fra getMatchVenueOptions) efter Baner-landsdele.
 * @returns {{ region: string, options: { id: string, label: string, courtId: string | null }[] }[]}
 */
export function groupMatchVenueOptionsFromFlat(flatOptions = []) {
  const venueOpts = (flatOptions || []).filter((o) => o && !isSpecialVenueOption(o.id))
  const byLabel = new Map(venueOpts.map((o) => [o.label, o]))
  return groupBanerVenuesByRegion()
    .map(({ region, venues }) => ({
      region,
      options: venues.map((v) => byLabel.get(v.title)).filter(Boolean),
    }))
    .filter((g) => g.options.length > 0)
}

export function splitMatchVenueOptions(allOptions = []) {
  const special = []
  const venues = []
  for (const o of allOptions || []) {
    if (!o) continue
    if (isSpecialVenueOption(o.id)) special.push(o)
    else venues.push(o)
  }
  return { special, venues }
}

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
      if (v.id.startsWith('match_padel_') && n.includes('match') && n.includes('padel'))
        return true
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
  if (selectedId === MATCH_VENUE_TBD) return ''
  const o = (options || []).find((x) => x.id === selectedId)
  return o?.label ?? ''
}

export function isMatchVenueTbd(selectedId) {
  return selectedId === MATCH_VENUE_TBD
}

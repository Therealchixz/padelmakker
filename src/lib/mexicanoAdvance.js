import {
  buildNextMexicanoRoundIfReady,
  getMaxRoundNumber,
  getMexicanoTotalRounds,
  isMexicanoFormat,
} from './mexicanoSchedule.js'

/**
 * Indsæt næste Mexicano-runde når forrige runde er færdig.
 * @returns {Promise<boolean>} true hvis ny runde blev oprettet
 */
export async function advanceMexicanoRoundIfReady({
  supabase,
  tournament,
  participantIdsInJoinOrder,
  matches,
  showToast,
}) {
  if (!isMexicanoFormat(tournament?.format)) return false
  if (tournament?.status !== 'playing') return false

  const ppm = Number(tournament.points_per_match)
  const P = ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
  const next = buildNextMexicanoRoundIfReady(
    tournament,
    participantIdsInJoinOrder,
    matches,
    P,
  )
  if (!next) return false

  const rows = Array.isArray(next) ? next : [next]
  const { error } = await supabase.from('americano_matches').insert(rows)
  if (error) throw error

  const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
  const total = getMexicanoTotalRounds(participantIdsInJoinOrder.length, passes)
  const roundNumber = rows[0]?.round_number ?? '?'
  showToast?.(`Runde ${roundNumber} af ${total} er genereret (${rows.length} kamp${rows.length !== 1 ? 'e' : ''}).`)
  return true
}

/**
 * @param {object} tournament
 * @param {string[]} participantIdsInJoinOrder
 * @param {import('./mexicanoSchedule.js').MexicanoMatchRow[]} matches
 */
export function mexicanoProgressLabel(tournament, participantIdsInJoinOrder, matches) {
  if (!isMexicanoFormat(tournament?.format)) return null
  const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
  const total = getMexicanoTotalRounds(participantIdsInJoinOrder.length, passes)
  const current = getMaxRoundNumber(matches)
  return `${current}/${total} runder`
}

/**
 * Mexicano scheduling: efter hver runde sorteres spillere efter point.
 * De spillere der er på banen vælges med færrest kampe (fair bænk), parres 1+4 vs 2+3 pr. bane.
 * Understøtter 4–16 spillere og 1..floor(n/4) baner pr. runde.
 */

/** @typedef {{ id: string, tournament_id?: string, round_number: number, court_index?: number, team_a_p1: string, team_a_p2: string, team_b_p1: string, team_b_p2: string, team_a_score?: number | null, team_b_score?: number | null, results_locked?: boolean | null, created_at?: string, updated_at?: string }} MexicanoMatchRow */

/**
 * Total antal runder for n spillere (ulige n → n runder, lige n → n−1 runder).
 * @param {number} playerCount
 * @param {1 | 2} [passes]
 */
export function getMexicanoTotalRounds(playerCount, passes = 1) {
  const n = Math.max(4, playerCount)
  const base = n % 2 === 0 ? n - 1 : n
  const p = passes === 2 ? 2 : 1
  return base * p
}

/**
 * @param {string} format
 */
export function isMexicanoFormat(format) {
  return String(format || 'americano').toLowerCase() === 'mexicano'
}

/**
 * @param {MexicanoMatchRow[]} matches
 * @param {number} roundNumber
 */
export function isRoundComplete(matches, roundNumber) {
  const roundMatches = (matches || []).filter((m) => m.round_number === roundNumber)
  if (roundMatches.length === 0) return false
  return roundMatches.every((m) => isMatchResultLocked(m))
}

function isMatchResultLocked(m) {
  const hasScores = m.team_a_score != null && m.team_b_score != null
  if (!hasScores) return false
  if (m.results_locked === false) return false
  return true
}

/**
 * @param {MexicanoMatchRow[]} matches
 */
export function getMaxRoundNumber(matches) {
  if (!matches?.length) return 0
  return Math.max(...matches.map((m) => m.round_number))
}

/**
 * @param {string[]} participantIdsInJoinOrder
 * @param {MexicanoMatchRow[]} priorMatches
 * @param {number} pointsPerMatch
 */
export function computeMexicanoStandings(participantIdsInJoinOrder, priorMatches, pointsPerMatch) {
  const P = pointsPerMatch
  const points = new Map()
  const appearances = new Map()
  const sortIndex = new Map()

  participantIdsInJoinOrder.forEach((id, idx) => {
    points.set(id, 0)
    appearances.set(id, 0)
    sortIndex.set(id, idx)
  })

  for (const m of priorMatches || []) {
    if (m.team_a_score == null || m.team_b_score == null) continue
    const a = Number(m.team_a_score)
    const b = Number(m.team_b_score)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a + b !== P) continue

    const add = (partId, pts) => {
      if (!points.has(partId)) return
      points.set(partId, (points.get(partId) ?? 0) + pts)
      appearances.set(partId, (appearances.get(partId) ?? 0) + 1)
    }
    add(m.team_a_p1, a)
    add(m.team_a_p2, a)
    add(m.team_b_p1, b)
    add(m.team_b_p2, b)
  }

  return participantIdsInJoinOrder.map((id) => ({
    participantId: id,
    points: points.get(id) ?? 0,
    courtAppearances: appearances.get(id) ?? 0,
    sortIndex: sortIndex.get(id) ?? 0,
  }))
}

/**
 * Vælg de 4*courts spillere på banen: færrest kampe først, derefter højeste point, derefter tilmeldingsrækkefølge.
 * @param {ReturnType<typeof computeMexicanoStandings>} standings
 * @param {number} [courts]
 */
export function selectMexicanoCourtPlayers(standings, courts = 1) {
  const n = Math.max(1, Math.min(courts, Math.floor(standings.length / 4)))
  const sorted = [...standings].sort((x, y) => {
    if (x.courtAppearances !== y.courtAppearances) {
      return x.courtAppearances - y.courtAppearances
    }
    if (y.points !== x.points) return y.points - x.points
    return x.sortIndex - y.sortIndex
  })
  return sorted.slice(0, 4 * n)
}

/**
 * Mexicano-parring for én bane: 1.+4. vs 2.+3. (efter point inden for de fire).
 * @param {ReturnType<typeof computeMexicanoStandings>} courtPlayers length 4
 */
export function pairMexicanoOnCourt(courtPlayers) {
  if (courtPlayers.length !== 4) {
    throw new Error(`Mexicano kræver præcis 4 på banen, fik ${courtPlayers.length}`)
  }
  const byRank = [...courtPlayers].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.sortIndex - b.sortIndex
  })
  return {
    teamA: [byRank[0].participantId, byRank[3].participantId],
    teamB: [byRank[1].participantId, byRank[2].participantId],
    bench: [],
  }
}

/**
 * Byg matches for én runde med N baner.
 * @param {object} params
 * @param {string} params.tournamentId
 * @param {number} params.roundNumber
 * @param {string[]} params.participantIdsInJoinOrder
 * @param {MexicanoMatchRow[]} params.priorMatches
 * @param {number} params.pointsPerMatch
 * @param {number} params.totalRounds
 * @param {number} [params.courtsPerRound]
 * @returns {import('../features/americano/types').AmericanoMatchInsert[]}
 */
export function buildMexicanoRoundMatches({
  tournamentId,
  roundNumber,
  participantIdsInJoinOrder,
  priorMatches,
  pointsPerMatch,
  totalRounds,
  courtsPerRound = 1,
}) {
  const n = participantIdsInJoinOrder.length
  if (n < 4 || n > 16) {
    throw new Error(`Mexicano understøtter 4–16 spillere, fik ${n}`)
  }
  if (roundNumber < 1 || roundNumber > totalRounds) return []

  const courts = Math.max(1, Math.min(courtsPerRound, Math.floor(n / 4)))
  const prior = (priorMatches || []).filter((m) => m.round_number < roundNumber)
  const standings = computeMexicanoStandings(participantIdsInJoinOrder, prior, pointsPerMatch)
  const courtPlayers = selectMexicanoCourtPlayers(standings, courts)

  const rows = []
  for (let c = 0; c < courts; c++) {
    const group = courtPlayers.slice(c * 4, c * 4 + 4)
    if (group.length !== 4) break
    const { teamA, teamB } = pairMexicanoOnCourt(group)
    rows.push({
      tournament_id: tournamentId,
      round_number: roundNumber,
      court_index: c,
      team_a_p1: teamA[0],
      team_a_p2: teamA[1],
      team_b_p1: teamB[0],
      team_b_p2: teamB[1],
    })
  }
  return rows
}

/**
 * Legacy single-match API (bagudkompatibilitet).
 * @deprecated Brug buildMexicanoRoundMatches i stedet.
 */
export function buildMexicanoRoundMatch(params) {
  const rows = buildMexicanoRoundMatches({ ...params, courtsPerRound: 1 })
  return rows[0] ?? null
}

/**
 * @param {object} tournament
 * @param {string[]} participantIdsInJoinOrder
 * @param {MexicanoMatchRow[]} matches
 * @param {number} pointsPerMatch
 * @returns {import('../features/americano/types').AmericanoMatchInsert[] | null}
 */
export function buildNextMexicanoRoundIfReady(tournament, participantIdsInJoinOrder, matches, pointsPerMatch) {
  const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
  const courts = Math.max(1, Number(tournament.courts_per_round) || 1)
  const totalRounds = getMexicanoTotalRounds(participantIdsInJoinOrder.length, passes)
  const maxRound = getMaxRoundNumber(matches)

  if (maxRound >= totalRounds) return null
  if (!isRoundComplete(matches, maxRound)) return null
  if (matches.some((m) => m.round_number > maxRound)) return null

  const rows = buildMexicanoRoundMatches({
    tournamentId: tournament.id,
    roundNumber: maxRound + 1,
    participantIdsInJoinOrder,
    priorMatches: matches,
    pointsPerMatch,
    totalRounds,
    courtsPerRound: courts,
  })
  return rows.length > 0 ? rows : null
}

/**
 * Første runde ved turneringsstart.
 * @param {string} tournamentId
 * @param {string[]} participantIdsInJoinOrder
 * @param {number} pointsPerMatch
 * @param {number} [passes]
 * @param {number} [courtsPerRound]
 */
export function buildMexicanoStartRoundRows(
  tournamentId,
  participantIdsInJoinOrder,
  pointsPerMatch,
  passes = 1,
  courtsPerRound = 1,
) {
  const p = passes === 2 ? 2 : 1
  const totalRounds = getMexicanoTotalRounds(participantIdsInJoinOrder.length, p)
  const rows = buildMexicanoRoundMatches({
    tournamentId,
    roundNumber: 1,
    participantIdsInJoinOrder,
    priorMatches: [],
    pointsPerMatch,
    totalRounds,
    courtsPerRound,
  })
  if (!rows.length) throw new Error('Kunne ikke oprette Mexicano runde 1')
  return rows
}

/**
 * @param {string[]} participantIdsOnCourt
 * @param {string[]} allParticipantIds
 */
export function mexicanoBenchParticipantIds(participantIdsOnCourt, allParticipantIds) {
  const onCourt = new Set(participantIdsOnCourt)
  return allParticipantIds.filter((id) => !onCourt.has(id))
}

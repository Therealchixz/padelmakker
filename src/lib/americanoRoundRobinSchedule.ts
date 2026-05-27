/**
 * Generisk Americano round-robin schedule for 4–16 spillere og 1–N baner.
 *
 * Algoritme: "circle method" (Berger-tabel) på spillerindeks.
 * - Ved ulige antal spillere indsættes én "dummy" (bænk-markering).
 * - Hver runde giver n/2 par. De første (2 * courtsPerRound) par bruges til kampe;
 *   resten er bænket.
 * - pairs[0]+pairs[1] → bane 0, pairs[2]+pairs[3] → bane 1, ...
 */

import type { AmericanoMatchInsert } from '../features/americano/types'

/** Total antal runder for n spillere (ulige n → n runder, lige n → n−1 runder). */
export function roundRobinTotalRounds(n: number): number {
  return n % 2 === 0 ? n - 1 : n
}

/**
 * Returner alle runder for round-robin med n spillere.
 * Returnerer indeks-par (ikke UUIDs) for hvert par i runden.
 * Indeks -1 = dummy (sidder over).
 */
function circleRounds(n: number): Array<Array<[number, number]>> {
  const even = n % 2 === 0
  const size = even ? n : n + 1 // arbejd med lige antal (tilføj dummy = size-1)
  const numRounds = size - 1
  // Placér spillerne: index 0 er fast, resten roterer
  const rotate = Array.from({ length: size - 1 }, (_, i) => i + 1)

  const rounds: Array<Array<[number, number]>> = []
  for (let r = 0; r < numRounds; r++) {
    const order = [0, ...rotate]
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < size / 2; i++) {
      const a = order[i]
      const b = order[size - 1 - i]
      pairs.push([a, b])
    }
    rounds.push(pairs)
    // Roter: sidste element af rotate går forrest
    rotate.unshift(rotate.pop()!)
  }
  return rounds
}

/**
 * Byg fuld Americano matchplan for n spillere og courtsPerRound baner.
 *
 * @param tournamentId  UUID af turneringen
 * @param participantIds  Sorteret liste af deltager-UUIDs (joined_at-rækkefølge)
 * @param courtsPerRound  Antal baner pr. runde (1..floor(n/4))
 * @param passes  1 = normal, 2 = dobbelt rundeplan
 */
export function buildAmericanoRoundRobinMatchRows(
  tournamentId: string,
  participantIds: string[],
  courtsPerRound = 1,
  passes: 1 | 2 = 1,
): AmericanoMatchInsert[] {
  const n = participantIds.length
  if (n < 4 || n > 16) throw new Error(`Americano kræver 4–16 spillere, fik ${n}`)
  const maxCourts = Math.floor(n / 4)
  const courts = Math.max(1, Math.min(courtsPerRound, maxCourts))

  const rounds = circleRounds(n)
  const dummy = n % 2 === 0 ? -1 : n // dummy indeks (aldrig i participantIds)
  const out: AmericanoMatchInsert[] = []

  const passCount: 1 | 2 = passes === 2 ? 2 : 1
  const baseRounds = rounds.length

  for (let pass = 0; pass < passCount; pass++) {
    const roundOffset = pass * baseRounds
    rounds.forEach((pairs, ri) => {
      const roundNumber = roundOffset + ri + 1
      // Filtrer par hvor ingen er dummy
      const realPairs = pairs.filter(([a, b]) => a !== dummy && b !== dummy)
      // Tag de første (2 * courts) indeks der danner kampe
      // Hvert par af to par → én kamp på én bane
      for (let c = 0; c < courts; c++) {
        const pairA = realPairs[c * 2]
        const pairB = realPairs[c * 2 + 1]
        if (!pairA || !pairB) break
        out.push({
          tournament_id: tournamentId,
          round_number: roundNumber,
          court_index: c,
          team_a_p1: participantIds[pairA[0]],
          team_a_p2: participantIds[pairA[1]],
          team_b_p1: participantIds[pairB[0]],
          team_b_p2: participantIds[pairB[1]],
        })
      }
    })
  }
  return out
}

/**
 * Antal "siddende over"-spillere pr. runde for n spillere og courtsPerRound baner.
 * Bruges til hjælpetekst og visning.
 */
export function benchCountPerRound(n: number, courtsPerRound: number): number {
  const courts = Math.max(1, Math.min(courtsPerRound, Math.floor(n / 4)))
  return n - courts * 4
}

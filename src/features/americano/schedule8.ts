import type { AmericanoMatchInsert } from './types'

/**
 * 8 spillere, 7 runder, 2 baner (2 kampe pr. runde).
 * Hver spiller har præcis én makker pr. runde og møder varierede modstandere.
 * Indeks 0..7 svarer til deltagerliste sorteret efter joined_at.
 */
export type Pair = readonly [number, number]
export type MatchIdx = { teamA: Pair; teamB: Pair }

const ROUNDS: MatchIdx[][] = [
  [
    { teamA: [0, 1], teamB: [2, 3] },
    { teamA: [4, 5], teamB: [6, 7] },
  ],
  [
    { teamA: [0, 2], teamB: [1, 5] },
    { teamA: [3, 7], teamB: [4, 6] },
  ],
  [
    { teamA: [0, 3], teamB: [2, 7] },
    { teamA: [1, 6], teamB: [4, 5] },
  ],
  [
    { teamA: [0, 4], teamB: [3, 6] },
    { teamA: [1, 7], teamB: [2, 5] },
  ],
  [
    { teamA: [0, 5], teamB: [1, 4] },
    { teamA: [2, 6], teamB: [3, 7] },
  ],
  [
    { teamA: [0, 6], teamB: [2, 4] },
    { teamA: [1, 3], teamB: [5, 7] },
  ],
  [
    { teamA: [0, 7], teamB: [3, 5] },
    { teamA: [1, 2], teamB: [4, 6] },
  ],
]

export function canScheduleAmericano(playerCount: number, slots: number): boolean {
  return slots === 8 && playerCount === 8
}

/**
 * participantIds: 8 UUIDs i samme rækkefølge som schedule-indekser
 */
export function buildAmericano8MatchRows(
  tournamentId: string,
  participantIds: string[]
): AmericanoMatchInsert[] {
  if (participantIds.length !== 8) {
    throw new Error('Americano 8 kræver præcis 8 tilmeldte')
  }
  const out: AmericanoMatchInsert[] = []
  ROUNDS.forEach((matches, roundIdx) => {
    const roundNumber = roundIdx + 1
    matches.forEach((m, courtIdx) => {
      const [a1, a2] = m.teamA
      const [b1, b2] = m.teamB
      out.push({
        tournament_id: tournamentId,
        round_number: roundNumber,
        court_index: courtIdx,
        team_a_p1: participantIds[a1],
        team_a_p2: participantIds[a2],
        team_b_p1: participantIds[b1],
        team_b_p2: participantIds[b2],
      })
    })
  })
  return out
}

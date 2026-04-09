import type { AmericanoMatchInsert } from './types'

/** Én bane: 2v2 + bench (5–7 spillere; 7 spillere har 3 på bench) */
type Round5 = { teamA: [number, number]; teamB: [number, number]; bench: readonly number[] }
type Round67 = { teamA: [number, number]; teamB: [number, number]; bench: readonly number[] }

/** 5 spillere: 4 på banen, 1 på sidelinjen — 5 runder */
const ROUNDS_5: Round5[] = [
  { teamA: [0, 1], teamB: [2, 3], bench: [4] },
  { teamA: [0, 2], teamB: [1, 4], bench: [3] },
  { teamA: [0, 3], teamB: [2, 4], bench: [1] },
  { teamA: [0, 4], teamB: [1, 3], bench: [2] },
  { teamA: [1, 2], teamB: [3, 4], bench: [0] },
]

/** 6 spillere: 4 på banen, 2 ude — 6 runder */
const ROUNDS_6: Round67[] = [
  { teamA: [0, 1], teamB: [2, 3], bench: [4, 5] },
  { teamA: [0, 2], teamB: [4, 5], bench: [1, 3] },
  { teamA: [0, 4], teamB: [1, 3], bench: [2, 5] },
  { teamA: [1, 5], teamB: [2, 4], bench: [0, 3] },
  { teamA: [0, 3], teamB: [1, 4], bench: [2, 5] },
  { teamA: [0, 5], teamB: [2, 4], bench: [1, 3] },
]

/** 7 spillere: 4 på banen, 3 ude — 7 runder */
const ROUNDS_7: Round67[] = [
  { teamA: [0, 1], teamB: [2, 3], bench: [4, 5, 6] },
  { teamA: [0, 2], teamB: [4, 5], bench: [1, 3, 6] },
  { teamA: [0, 3], teamB: [1, 6], bench: [2, 4, 5] },
  { teamA: [0, 4], teamB: [1, 5], bench: [2, 3, 6] },
  { teamA: [0, 5], teamB: [2, 6], bench: [1, 3, 4] },
  { teamA: [0, 6], teamB: [3, 4], bench: [1, 2, 5] },
  { teamA: [1, 2], teamB: [3, 5], bench: [0, 4, 6] },
]

function pushRound(
  out: AmericanoMatchInsert[],
  tournamentId: string,
  roundNumber: number,
  teamA: [number, number],
  teamB: [number, number],
  participantIds: string[]
) {
  out.push({
    tournament_id: tournamentId,
    round_number: roundNumber,
    court_index: 0,
    team_a_p1: participantIds[teamA[0]],
    team_a_p2: participantIds[teamA[1]],
    team_b_p1: participantIds[teamB[0]],
    team_b_p2: participantIds[teamB[1]],
  })
}

type Passes = 1 | 2

function appendRounds(
  out: AmericanoMatchInsert[],
  tournamentId: string,
  rounds: readonly { teamA: [number, number]; teamB: [number, number] }[],
  participantIds: string[],
  roundOffset: number
) {
  rounds.forEach((r, i) => pushRound(out, tournamentId, roundOffset + i + 1, r.teamA, r.teamB, participantIds))
}

export function buildAmericano578MatchRows(
  tournamentId: string,
  participantIds: string[],
  passes: Passes = 1
): AmericanoMatchInsert[] {
  const n = participantIds.length
  const out: AmericanoMatchInsert[] = []
  const p: Passes = passes === 2 ? 2 : 1

  let rounds: readonly { teamA: [number, number]; teamB: [number, number] }[]
  if (n === 5) rounds = ROUNDS_5
  else if (n === 6) rounds = ROUNDS_6
  else if (n === 7) rounds = ROUNDS_7
  else throw new Error(`Forventet 5, 6 eller 7 tilmeldte, fik ${n}`)

  const len = rounds.length
  for (let pass = 0; pass < p; pass++) {
    appendRounds(out, tournamentId, rounds, participantIds, pass * len)
  }
  return out
}

/** Start når antal tilmeldte matcher valgt turneringsstørrelse (5, 6 eller 7). */
export function canStartAmericano5767(playerCount: number, configuredSlots: number): boolean {
  return (
    (configuredSlots === 5 || configuredSlots === 6 || configuredSlots === 7) &&
    playerCount === configuredSlots
  )
}

/**
 * Generisk Americano round-robin schedule for 4–16 spillere og 1–N baner.
 *
 * Antal runder (Normal) beregnes så alle kan nå at være makker og modstander med alle andre,
 * når det er matematisk muligt med valgte baner. "Lang" = samme plan to gange.
 */

import type { AmericanoMatchInsert } from '../features/americano/types'

type MatchIdx = { teamA: [number, number]; teamB: [number, number] }
type RoundIdx = MatchIdx[]

/** Klassisk cirkel-round-robin (ulige n → n runder, lige n → n−1). */
export function roundRobinTotalRounds(n: number): number {
  return n % 2 === 0 ? n - 1 : n
}

function clampCourts(n: number, courtsPerRound: number): number {
  const maxCourts = Math.floor(n / 4)
  return Math.max(1, Math.min(courtsPerRound, maxCourts))
}

function pairKey(i: number, j: number): string {
  return i < j ? `${i},${j}` : `${j},${i}`
}

/** Par-kombinationer der skal dækkes (makker + modstander). */
function totalPairCombinations(n: number): number {
  return (n * (n - 1)) / 2
}

/** Teoretisk minimum (makker- og modstanderpar) før planlægger-justering. */
function theoreticalMinRounds(n: number, courts: number): number {
  const pairs = totalPairCombinations(n)
  const forPartners = Math.ceil(pairs / (2 * courts))
  const forOpponents = Math.ceil(pairs / (4 * courts))
  return Math.max(roundRobinTotalRounds(n), forPartners, forOpponents)
}

function coverageComplete(n: number, partnerMet: Set<string>, oppMet: Set<string>): boolean {
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = pairKey(i, j)
      if (!partnerMet.has(key) || !oppMet.has(key)) return false
    }
  }
  return true
}

/**
 * Antal runder (Normal) — plan bygges så alle er makker og modstander med alle andre.
 */
export function americanoBaseRounds(n: number, courtsPerRound = 1): number {
  if (n < 4 || n > 16) {
    throw new Error(`Americano kræver 4–16 spillere, fik ${n}`)
  }
  const courts = clampCourts(n, courtsPerRound)
  const minRounds = theoreticalMinRounds(n, courts)
  return buildScheduleRounds(n, courts, minRounds).length
}

export function americanoTotalRounds(
  n: number,
  courtsPerRound = 1,
  passes: 1 | 2 = 1,
): number {
  const base = americanoBaseRounds(n, courtsPerRound)
  return base * (passes === 2 ? 2 : 1)
}

/**
 * Returner alle runder for round-robin med n spillere (cirkelmetode).
 * Indeks -1 eller n (ulige) = dummy (sidder over).
 */
function circleRounds(n: number): Array<Array<[number, number]>> {
  const even = n % 2 === 0
  const size = even ? n : n + 1
  const numRounds = size - 1
  const rotate = Array.from({ length: size - 1 }, (_, i) => i + 1)

  const rounds: Array<Array<[number, number]>> = []
  for (let r = 0; r < numRounds; r++) {
    const order = [0, ...rotate]
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < size / 2; i++) {
      pairs.push([order[i], order[size - 1 - i]])
    }
    rounds.push(pairs)
    rotate.unshift(rotate.pop()!)
  }
  return rounds
}

function circleRoundsToMatches(n: number, courts: number): RoundIdx[] {
  const dummy = n % 2 === 0 ? -1 : n
  const out: RoundIdx[] = []
  for (const pairs of circleRounds(n)) {
    const realPairs = pairs.filter(([a, b]) => a !== dummy && b !== dummy)
    const round: MatchIdx[] = []
    for (let c = 0; c < courts; c++) {
      const pairA = realPairs[c * 2]
      const pairB = realPairs[c * 2 + 1]
      if (!pairA || !pairB) break
      round.push({
        teamA: [pairA[0], pairA[1]],
        teamB: [pairB[0], pairB[1]],
      })
    }
    if (round.length > 0) out.push(round)
  }
  return out
}

function bestMatchForFour(
  players: [number, number, number, number],
  partnerMet: Set<string>,
  oppMet: Set<string>,
): MatchIdx {
  const [p0, p1, p2, p3] = players
  const options: MatchIdx[] = [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ]
  let best = options[0]
  let bestScore = -1
  for (const o of options) {
    let score = 0
    const [a1, a2] = o.teamA
    const [b1, b2] = o.teamB
    if (!partnerMet.has(pairKey(a1, a2))) score += 10
    if (!partnerMet.has(pairKey(b1, b2))) score += 10
    for (const a of o.teamA) {
      for (const b of o.teamB) {
        if (!oppMet.has(pairKey(a, b))) score += 5
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = o
    }
  }
  return best
}

function recordMatch(m: MatchIdx, partnerMet: Set<string>, oppMet: Set<string>) {
  const [a1, a2] = m.teamA
  const [b1, b2] = m.teamB
  partnerMet.add(pairKey(a1, a2))
  partnerMet.add(pairKey(b1, b2))
  for (const a of m.teamA) {
    for (const b of m.teamB) {
      oppMet.add(pairKey(a, b))
    }
  }
}

/** Del 4*k spillere i k kampe (1 bane = ét match). */
function bestRoundMatches(
  selected: number[],
  courts: number,
  partnerMet: Set<string>,
  oppMet: Set<string>,
): MatchIdx[] {
  const k = courts
  if (selected.length !== 4 * k) {
    throw new Error(`Forventede ${4 * k} spillere på banen, fik ${selected.length}`)
  }

  if (k === 1) {
    const m = bestMatchForFour(
      selected as [number, number, number, number],
      partnerMet,
      oppMet,
    )
    return [m]
  }

  // 2+ baner: prøv op til 24 tilfældige partitioner (hurtigt for n≤16)
  let bestRound: MatchIdx[] | null = null
  let bestScore = -1
  const nSel = selected.length

  const tryPartition = (groupA: number[]) => {
    const setA = new Set(groupA)
    const groupB = selected.filter((p) => !setA.has(p))
    if (groupB.length !== 4 * k - 4) return
    const m1 = bestMatchForFour(groupA as [number, number, number, number], partnerMet, oppMet)
    const m2 = bestMatchForFour(groupB as [number, number, number, number], partnerMet, oppMet)
    let score = 0
    for (const m of [m1, m2]) {
      const [a1, a2] = m.teamA
      const [b1, b2] = m.teamB
      if (!partnerMet.has(pairKey(a1, a2))) score += 10
      if (!partnerMet.has(pairKey(b1, b2))) score += 10
      for (const a of m.teamA) {
        for (const b of m.teamB) {
          if (!oppMet.has(pairKey(a, b))) score += 5
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestRound = [m1, m2]
    }
  }

  if (k === 2) {
    const combos: number[][] = [
      [0, 1, 2, 3],
      [0, 1, 4, 5],
      [0, 2, 4, 6],
      [0, 3, 5, 6],
      [1, 2, 5, 6],
      [2, 3, 4, 5],
    ]
    for (const idxs of combos) {
      tryPartition(idxs.map((i) => selected[i]))
    }
  } else {
    // 3–4 baner: grupper af 4 i rækkefølge efter playCount-sortering
    const groups: number[][] = []
    for (let c = 0; c < k; c++) {
      groups.push(selected.slice(c * 4, c * 4 + 4))
    }
    bestRound = groups.map((g) =>
      bestMatchForFour(g as [number, number, number, number], partnerMet, oppMet),
    )
  }

  if (!bestRound) {
    const groups: number[][] = []
    for (let c = 0; c < k; c++) {
      groups.push(selected.slice(c * 4, c * 4 + 4))
    }
    bestRound = groups.map((g) =>
      bestMatchForFour(g as [number, number, number, number], partnerMet, oppMet),
    )
  }
  return bestRound
}

function pickPlayersForRound(n: number, courts: number, playCount: number[]): number[] {
  const onCourt = Math.min(n, courts * 4)
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    const d = playCount[a] - playCount[b]
    return d !== 0 ? d : a - b
  })
  return order.slice(0, onCourt)
}

/** Byg rundeplan med mindst targetRounds runder; cirkel + greedy-udvidelse. */
function buildScheduleRounds(n: number, courts: number, targetRounds: number): RoundIdx[] {
  const circle = circleRoundsToMatches(n, courts)

  const partnerMet = new Set<string>()
  const oppMet = new Set<string>()
  const playCount = Array(n).fill(0)
  const rounds: RoundIdx[] = []

  for (const round of circle.slice(0, Math.min(circle.length, targetRounds))) {
    for (const m of round) recordMatch(m, partnerMet, oppMet)
    for (const m of round) {
      for (const p of [...m.teamA, ...m.teamB]) playCount[p]++
    }
    rounds.push(round)
  }

  while (rounds.length < targetRounds) {
    const selected = pickPlayersForRound(n, courts, playCount)
    const matches = bestRoundMatches(selected, courts, partnerMet, oppMet)
    for (const m of matches) recordMatch(m, partnerMet, oppMet)
    for (const p of selected) playCount[p]++
    rounds.push(matches)
  }

  const maxRounds = targetRounds + n * 4
  while (!coverageComplete(n, partnerMet, oppMet) && rounds.length < maxRounds) {
    const selected = pickPlayersForRound(n, courts, playCount)
    const matches = bestRoundMatches(selected, courts, partnerMet, oppMet)
    for (const m of matches) recordMatch(m, partnerMet, oppMet)
    for (const p of selected) playCount[p]++
    rounds.push(matches)
  }

  return rounds
}

/**
 * Byg fuld Americano matchplan for n spillere og courtsPerRound baner.
 */
export function buildAmericanoRoundRobinMatchRows(
  tournamentId: string,
  participantIds: string[],
  courtsPerRound = 1,
  passes: 1 | 2 = 1,
): AmericanoMatchInsert[] {
  const n = participantIds.length
  if (n < 4 || n > 16) throw new Error(`Americano kræver 4–16 spillere, fik ${n}`)
  const courts = clampCourts(n, courtsPerRound)
  const minRounds = theoreticalMinRounds(n, courts)
  const schedule = buildScheduleRounds(n, courts, minRounds)
  const baseRounds = schedule.length
  const passCount: 1 | 2 = passes === 2 ? 2 : 1
  const out: AmericanoMatchInsert[] = []

  for (let pass = 0; pass < passCount; pass++) {
    const roundOffset = pass * baseRounds
    schedule.forEach((round, ri) => {
      const roundNumber = roundOffset + ri + 1
      round.forEach((m, courtIndex) => {
        out.push({
          tournament_id: tournamentId,
          round_number: roundNumber,
          court_index: courtIndex,
          team_a_p1: participantIds[m.teamA[0]],
          team_a_p2: participantIds[m.teamA[1]],
          team_b_p1: participantIds[m.teamB[0]],
          team_b_p2: participantIds[m.teamB[1]],
        })
      })
    })
  }
  return out
}

/**
 * Antal "siddende over"-spillere pr. runde for n spillere og courtsPerRound baner.
 */
export function benchCountPerRound(n: number, courtsPerRound: number): number {
  const courts = clampCourts(n, courtsPerRound)
  return n - courts * 4
}

/**
 * Tilfældig (men stabil) deltager-rækkefølge til turneringsplanlægning.
 * Seed = turnering + deltager-sæt — ikke tilmeldingsrækkefølge.
 */

function fnv1aHash(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedForSchedule(tournamentId: string, participantIds: string[]): number {
  const rosterKey = [...participantIds].sort().join(',')
  return fnv1aHash(`${String(tournamentId).trim()}|${rosterKey}`)
}

/**
 * Fisher–Yates shuffle med seed — samme turnering + samme deltagere giver samme plan.
 */
export function shuffleParticipantIdsForSchedule(
  participantIds: string[],
  tournamentId: string,
): string[] {
  const ids = [...participantIds]
  if (ids.length <= 1) return ids

  const rand = mulberry32(seedForSchedule(tournamentId, ids))
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

/** Stabil tilmeldingsrækkefølge (kun input til shuffle — ikke selve planen). */
export function sortParticipantIdsByJoinOrder<T extends { id: string; joined_at: string }>(
  participants: T[],
): string[] {
  return [...participants]
    .sort((a, b) => {
      const ta = new Date(a.joined_at).getTime()
      const tb = new Date(b.joined_at).getTime()
      if (ta !== tb) return ta - tb
      return String(a.id).localeCompare(String(b.id))
    })
    .map((p) => p.id)
}

export function orderParticipantIdsForSchedule(
  participantIds: string[],
  tournamentId: string,
): string[] {
  return shuffleParticipantIdsForSchedule(participantIds, tournamentId)
}

export function orderParticipantsForSchedule<T extends { id: string; joined_at: string }>(
  participants: T[],
  tournamentId: string,
): string[] {
  const joinOrder = sortParticipantIdsByJoinOrder(participants)
  return orderParticipantIdsForSchedule(joinOrder, tournamentId)
}

/** Fælles farver: sejr (grøn), uafgjort (lys grå), tab (rød) — Americano + profil */
export const americanoOutcomeColors = {
  win: {
    bg: 'var(--pm-green-bg)',
    border: 'var(--pm-green)',
    text: 'var(--pm-green)',
  },
  tie: {
    bg: 'var(--pm-surface-alt)',
    border: 'var(--pm-border)',
    text: 'var(--pm-text-mid)',
  },
  loss: {
    bg: 'var(--pm-red-bg)',
    border: 'var(--pm-red)',
    text: 'var(--pm-red)',
  },
  neutral: {
    bg: 'var(--pm-surface)',
    border: 'var(--pm-border)',
    text: 'var(--pm-text)',
  },
} as const

export type AmericanoViewerMatchOutcome = 'win' | 'loss' | 'tie' | 'neutral'

/** Om **du** vandt, tabte eller spillede uafgjort i denne kamp (eller ikke var på banen). */
export function americanoOutcomeForUserInMatch(
  m: {
    team_a_p1: string
    team_a_p2: string
    team_b_p1: string
    team_b_p2: string
    team_a_score: number | null
    team_b_score: number | null
  },
  userIdByParticipantId: Map<string, string>,
  currentUserId: string,
  pointsPerMatch: number
): AmericanoViewerMatchOutcome {
  const a = m.team_a_score
  const b = m.team_b_score
  if (a == null || b == null) return 'neutral'
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return 'neutral'
  if (a + b !== pointsPerMatch) return 'neutral'

  const uid = String(currentUserId)
  const onA =
    userIdByParticipantId.get(m.team_a_p1) === uid || userIdByParticipantId.get(m.team_a_p2) === uid
  const onB =
    userIdByParticipantId.get(m.team_b_p1) === uid || userIdByParticipantId.get(m.team_b_p2) === uid
  if (!onA && !onB) return 'neutral'

  if (a === b) return 'tie'
  if (onA) return a > b ? 'win' : 'loss'
  return b > a ? 'win' : 'loss'
}

export function userIsOnCourtInAmericanoMatch(
  m: {
    team_a_p1: string
    team_a_p2: string
    team_b_p1: string
    team_b_p2: string
  },
  userIdByParticipantId: Map<string, string>,
  currentUserId: string
): boolean {
  const uid = String(currentUserId)
  return (
    userIdByParticipantId.get(m.team_a_p1) === uid ||
    userIdByParticipantId.get(m.team_a_p2) === uid ||
    userIdByParticipantId.get(m.team_b_p1) === uid ||
    userIdByParticipantId.get(m.team_b_p2) === uid
  )
}

/** Vist under hver kamp: din status som spiller eller at du sidder over. */
export function americanoViewerStatusLabel(
  outcome: AmericanoViewerMatchOutcome,
  onCourt: boolean
): string {
  if (!onCourt) return 'Sidder over'
  if (outcome === 'win') return 'Vundet'
  if (outcome === 'loss') return 'Tabt'
  if (outcome === 'tie') return 'Uafgjort'
  return 'Afventer resultat'
}

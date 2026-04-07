/** Nye turneringer: 5, 6 eller 7. 8 = kun ældre rækker fra før skiftet (stadig startbar med 8 deltagere). */
export type AmericanoPlayerSlots = 5 | 6 | 7 | 8
export type AmericanoPoints = 16 | 24 | 32
export type AmericanoStatus = 'registration' | 'playing' | 'completed'

/** 1 = normal længde; 2 = rundeplanen køres to gange (længere, flere modstander-/makker-møder) */
export type AmericanoOpponentPasses = 1 | 2

export type AmericanoTournament = {
  id: string
  creator_id: string
  name: string
  tournament_date: string
  time_slot: string
  court_id: string | null
  player_slots: AmericanoPlayerSlots
  points_per_match: AmericanoPoints
  opponent_passes?: AmericanoOpponentPasses | null
  description: string | null
  status: AmericanoStatus
  created_at: string
  updated_at: string
}

export type AmericanoParticipant = {
  id: string
  tournament_id: string
  user_id: string
  display_name: string
  joined_at: string
}

export type AmericanoMatchRow = {
  id: string
  tournament_id: string
  round_number: number
  court_index: number
  team_a_p1: string
  team_a_p2: string
  team_b_p1: string
  team_b_p2: string
  team_a_score: number | null
  team_b_score: number | null
}

/** Til insert før generering (uden scores) */
export type AmericanoMatchInsert = {
  tournament_id: string
  round_number: number
  court_index: number
  team_a_p1: string
  team_a_p2: string
  team_b_p1: string
  team_b_p2: string
}

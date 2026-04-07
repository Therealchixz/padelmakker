export type AmericanoPlayerSlots = 8 | 12 | 16
export type AmericanoPoints = 16 | 24 | 32
export type AmericanoStatus = 'registration' | 'playing' | 'completed'

export type AmericanoTournament = {
  id: string
  creator_id: string
  name: string
  tournament_date: string
  time_slot: string
  court_id: string | null
  player_slots: AmericanoPlayerSlots
  points_per_match: AmericanoPoints
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

/** 4–16 spillere. 5–8 er de klassiske værdier; 4 og 9–16 kræver den nye round-robin generator. */
export type AmericanoPlayerSlots = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
export type AmericanoPoints = 16 | 24 | 32
export type AmericanoStatus = 'registration' | 'playing' | 'completed'

/** 1 = normal længde; 2 = rundeplanen køres to gange (længere, flere modstander-/makker-møder) */
export type AmericanoOpponentPasses = 1 | 2

export type AmericanoTournamentFormat = 'americano' | 'mexicano'

export type AmericanoTournament = {
  id: string
  creator_id: string
  name: string
  tournament_date: string
  time_slot: string
  court_id: string | null
  player_slots: AmericanoPlayerSlots
  courts_per_round?: number | null
  points_per_match: AmericanoPoints
  opponent_passes?: AmericanoOpponentPasses | null
  format?: AmericanoTournamentFormat | null
  description: string | null
  status: AmericanoStatus
  created_at: string
  updated_at: string
  completed_at?: string | null
  level_min?: number | null
  level_max?: number | null
  duration_minutes?: number | null
  price_per_person?: number | null
  payment_method?: string | null
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
  /** Efter Gem: sand; opretter kan låse op i UI for at rette */
  results_locked?: boolean | null
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

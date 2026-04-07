-- =============================================================================
-- Performance Advisor: unindexed foreign keys (Lint 0001)
-- =============================================================================
-- Kør i Supabase → SQL Editor. Bruger IF NOT EXISTS — sikker at køre flere gange.
--
-- Hvis en kolonne hedder anderledes hos jer, ret navnet (se Table Editor) eller
-- fjern den linje der fejler.
-- =============================================================================

-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_court_id ON public.bookings (court_id);

-- court_slots
CREATE INDEX IF NOT EXISTS idx_court_slots_court_id ON public.court_slots (court_id);
CREATE INDEX IF NOT EXISTS idx_court_slots_booked_by ON public.court_slots (booked_by);

-- elo_history
CREATE INDEX IF NOT EXISTS idx_elo_history_user_id ON public.elo_history (user_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_match_id ON public.elo_history (match_id);

-- match_players
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON public.match_players (user_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON public.match_players (match_id);

-- match_results
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON public.match_results (match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_submitted_by ON public.match_results (submitted_by);
CREATE INDEX IF NOT EXISTS idx_match_results_confirmed_by ON public.match_results (confirmed_by);
CREATE INDEX IF NOT EXISTS idx_match_results_team1_player1_id ON public.match_results (team1_player1_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team1_player2_id ON public.match_results (team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team2_player1_id ON public.match_results (team2_player1_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team2_player2_id ON public.match_results (team2_player2_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_creator_id ON public.matches (creator_id);
CREATE INDEX IF NOT EXISTS idx_matches_court_id ON public.matches (court_id);
CREATE INDEX IF NOT EXISTS idx_matches_started_by ON public.matches (started_by);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages (receiver_id);

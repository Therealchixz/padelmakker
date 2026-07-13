-- ─────────────────────────────────────────────────────────────
-- Oprydning af [DEMO]-testdata (kampe, americano/mexicano, ligaer).
-- Kør i Supabase SQL editor for at fjerne ALT demo-data igen.
-- Alt demo-data er markeret med '[DEMO]' i description-feltet.
-- ─────────────────────────────────────────────────────────────

-- 2v2-kampe
DELETE FROM public.match_results WHERE match_id IN (SELECT id FROM public.matches WHERE description LIKE '[DEMO]%');
DELETE FROM public.match_players WHERE match_id IN (SELECT id FROM public.matches WHERE description LIKE '[DEMO]%');
DELETE FROM public.match_photos  WHERE match_id IN (SELECT id FROM public.matches WHERE description LIKE '[DEMO]%');
DELETE FROM public.matches WHERE description LIKE '[DEMO]%';

-- Americano / Mexicano
DELETE FROM public.americano_matches      WHERE tournament_id IN (SELECT id FROM public.americano_tournaments WHERE description LIKE '[DEMO]%');
DELETE FROM public.americano_participants  WHERE tournament_id IN (SELECT id FROM public.americano_tournaments WHERE description LIKE '[DEMO]%');
DELETE FROM public.americano_tournaments   WHERE description LIKE '[DEMO]%';

-- Ligaer
DELETE FROM public.league_matches WHERE league_id IN (SELECT id FROM public.leagues WHERE description LIKE '[DEMO]%');
DELETE FROM public.league_teams   WHERE league_id IN (SELECT id FROM public.leagues WHERE description LIKE '[DEMO]%');
DELETE FROM public.leagues WHERE description LIKE '[DEMO]%';

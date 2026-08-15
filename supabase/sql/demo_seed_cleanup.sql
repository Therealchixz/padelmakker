-- ─────────────────────────────────────────────────────────────
-- Oprydning af [DEMO]/prøve-testdata (kampe, americano/mexicano, ligaer).
-- Kør i Supabase SQL editor. ELO på profiler synces via history-triggers.
-- ─────────────────────────────────────────────────────────────

BEGIN;

CREATE TEMP TABLE demo_match_ids ON COMMIT DROP AS
SELECT id FROM public.matches
WHERE coalesce(description, '') LIKE '[DEMO]%';

CREATE TEMP TABLE demo_tournament_ids ON COMMIT DROP AS
SELECT id FROM public.americano_tournaments
WHERE coalesce(description, '') LIKE '[DEMO]%'
   OR name IN ('Test', 'Ll', 'Lol');

CREATE TEMP TABLE demo_league_ids ON COMMIT DROP AS
SELECT id FROM public.leagues
WHERE coalesce(description, '') LIKE '[DEMO]%'
   OR name IN ('Test', 'Hejeh');

DELETE FROM public.notifications
WHERE entity_id IN (SELECT id FROM demo_tournament_ids)
   OR entity_id IN (SELECT id FROM demo_league_ids);

DELETE FROM public.matches
WHERE id IN (SELECT id FROM demo_match_ids);

DELETE FROM public.americano_matches
WHERE tournament_id IN (SELECT id FROM demo_tournament_ids);

DELETE FROM public.americano_participants
WHERE tournament_id IN (SELECT id FROM demo_tournament_ids);

DELETE FROM public.americano_tournaments
WHERE id IN (SELECT id FROM demo_tournament_ids);

DELETE FROM public.league_matches
WHERE league_id IN (SELECT id FROM demo_league_ids);

DELETE FROM public.league_teams
WHERE league_id IN (SELECT id FROM demo_league_ids);

DELETE FROM public.leagues
WHERE id IN (SELECT id FROM demo_league_ids);

COMMIT;

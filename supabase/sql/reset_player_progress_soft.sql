-- =============================================================================
-- Blød nulstilling: alle spillere som “nye” ift. kampe og ELO — UDEN at slette
-- konti eller profilrækker (navn, email, område, osv. bevares).
-- =============================================================================
-- Kør i Supabase → SQL Editor som postgres / service role (RLS kan blokere
-- DELETE fra klienten; SQL Editor kører typisk med fuld adgang).
--
-- SLETTER / NULSTILLER:
--   - elo_history, match_results, match_players, matches
--   - (valgfrit) notifications, messages, bookings — se nederst
-- OPDATERER:
--   - profiles: elo_rating = 1000, games_played = 0, games_won = 0
--
-- SLETTER IKKE:
--   - auth.users (login bevares)
--   - profiles-rækker (kun tal-kolonner nulstilles)
--   - courts, court_slots (baner)
-- =============================================================================

BEGIN;

-- Rækkefølge pga. fremmednøgler (tilpas hvis dit skema afviger)
DELETE FROM public.elo_history;
DELETE FROM public.match_results;
DELETE FROM public.match_players;
DELETE FROM public.matches;

-- Profilstatistik tilbage til start (alle brugere)
UPDATE public.profiles
SET
  elo_rating   = 1000,
  games_played = 0,
  games_won    = 0;

-- ---------------------------------------------------------------------------
-- Valgfrit: fjern kommentarer hvis tabellerne findes og du vil rydde dem too
-- ---------------------------------------------------------------------------
-- DELETE FROM public.notifications;
-- DELETE FROM public.messages;
-- DELETE FROM public.bookings;

COMMIT;

-- =============================================================================
-- Efter kørsel: genindlæs appen. Brugere er stadig logget ind (session i
-- browser), men data er tom/fresh.
-- =============================================================================

-- =============================================================================
-- SLET ALLE BRUGERE OG BRUGERRELATERET DATA (irreversibelt)
-- =============================================================================
-- Kør i Supabase → SQL Editor. Kræver rettigheder til både public og auth.
--
-- Sletter IKKE: courts, court_slots (baner kan du beholde til test).
-- Tilføj/fjern DELETE-linjer hvis jeres skema har andre tabeller.
--
-- Efter kørsel: ingen kan logge ind med gamle konti. Opret nye via appen.
-- =============================================================================

BEGIN;

-- 1) Offentlige tabeller (børn først). Kommentér ud eller slet linjer du ikke har:
DELETE FROM public.elo_history;
DELETE FROM public.bookings;
DELETE FROM public.messages;
-- DELETE FROM public.notifications;  -- tilføj hvis tabellen findes

DELETE FROM public.match_results;
DELETE FROM public.match_players;
DELETE FROM public.matches;

DELETE FROM public.profiles;

-- 2) Auth: alle brugerkonti (sessions/identities m.m. følger typisk med)
DELETE FROM auth.users;

COMMIT;

-- =============================================================================
-- Valgfrit: ryd også baner og tider (kun hvis du vil starte helt forfra)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.court_slots;
-- DELETE FROM public.courts;
-- COMMIT;

-- =============================================================================
-- Storage: hvis I har bruger-uploads (avatars) i en bucket, slet dem i
-- Dashboard → Storage, eller via API — SQL sletter ikke filer i bucket.
-- =============================================================================

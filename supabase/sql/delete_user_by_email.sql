-- =============================================================================
-- Slet ÉN bruger ud fra email (så du kan genbruge mailen til nyt signup)
-- =============================================================================
-- Kør i Supabase → SQL Editor.
--
-- VIGTIGT:
-- - Sletter også alle KAMPE brugeren har oprettet ELLER deltaget i (hele kampen
--   for alle spillere — ikke kun brugerens rækker). Til testkonti er det typisk ok.
-- - Ret email nedenfor (én streng).
-- - Hvis du får fejl på en tabel du ikke har (fx notifications), kommentér den
--   DELETE ud eller fjern linjen.
-- =============================================================================

DO $$
DECLARE
  uid uuid;
  -- ← Skriv den mail du vil fjerne helt (små bogstaver anbefales)
  target_email text := lower(trim('din@email.dk'));
  mids uuid[];
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = target_email;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Ingen række i auth.users med email: % (tjek stavning og om den allerede er slettet).', target_email;
  END IF;

  -- Alle match-id'er brugeren er koblet til (som skaber eller spiller)
  SELECT array_agg(DISTINCT m) INTO mids
  FROM (
    SELECT id AS m FROM public.matches WHERE creator_id = uid
    UNION
    SELECT match_id AS m FROM public.match_players WHERE user_id = uid AND match_id IS NOT NULL
  ) s
  WHERE m IS NOT NULL;

  IF mids IS NOT NULL AND cardinality(mids) > 0 THEN
    DELETE FROM public.match_results WHERE match_id = ANY (mids);
    DELETE FROM public.match_players WHERE match_id = ANY (mids);
    DELETE FROM public.matches WHERE id = ANY (mids);
  END IF;

  DELETE FROM public.elo_history WHERE user_id = uid;

  -- Valgfrit — fjern kommentar hvis tabellen findes:
  -- DELETE FROM public.notifications WHERE user_id = uid;

  -- Tilpas kolonnenavne hvis jeres skema er anderledes:
  -- DELETE FROM public.messages WHERE sender_id = uid OR recipient_id = uid;
  -- DELETE FROM public.bookings WHERE user_id = uid;

  DELETE FROM public.profiles WHERE id = uid;

  DELETE FROM auth.users WHERE id = uid;

  RAISE NOTICE 'Bruger slettet: % (id: %). Du kan nu oprette ny konto med samme email.', target_email, uid;
END $$;

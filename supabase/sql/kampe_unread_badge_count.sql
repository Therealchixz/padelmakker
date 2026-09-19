-- Ét kald i stedet for otte.
--
-- Kampe-fanens tal blev regnet ud i browseren: fem parallelle opslag for at
-- finde brugerens kampe, ligaer og turneringer, derefter et chunked opslag for
-- kampenes status og til sidst to opslag i notifications. Det kørte hvert
-- 10. sekund pr. åben fane og voksede med antallet af kampe brugeren har.
--
-- Logikken er flyttet hertil uændret, så tallet bliver det samme:
--   - match_invite tælles aldrig med (styres af åbne join-anmodninger)
--   - match_chat tæller altid
--   - åben/fuld kamp: match_join, match_full, match_cancelled, seeking_player
--   - i gang:        result_submitted, match_cancelled
--   - afsluttet:     result_confirmed
--   - turnerings- og ligabeskeder tæller når brugeren deltager i eller har
--     oprettet den pågældende turnering/liga
--
-- SECURITY INVOKER: funktionen ser kun det brugeren selv må se, og
-- notifications har i forvejen en policy der kun giver adgang til egne rækker.

CREATE OR REPLACE FUNCTION public.kampe_unread_badge_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_match_count integer := 0;
  v_entity_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*)::int INTO v_match_count
  FROM public.notifications n
  JOIN public.matches m ON m.id = n.match_id
  WHERE n.user_id = v_uid
    AND n.read = false
    AND n.type <> 'match_invite'
    AND (
      m.creator_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = m.id AND mp.user_id = v_uid
      )
    )
    AND (
      n.type = 'match_chat'
      OR (lower(coalesce(m.status, 'open')) IN ('open', 'full')
          AND n.type IN ('match_join', 'match_full', 'match_cancelled', 'seeking_player'))
      OR (lower(coalesce(m.status, 'open')) = 'in_progress'
          AND n.type IN ('result_submitted', 'match_cancelled'))
      OR (lower(coalesce(m.status, 'open')) = 'completed'
          AND n.type = 'result_confirmed')
    );

  SELECT count(*)::int INTO v_entity_count
  FROM public.notifications n
  WHERE n.user_id = v_uid
    AND n.read = false
    AND n.entity_id IS NOT NULL
    AND n.type IN (
      'americano_invite', 'americano_full', 'americano_started', 'americano_completed',
      'americano_spot_open', 'americano_cancelled', 'league_full', 'league_started',
      'league_completed', 'team_invite', 'team_invite_accepted', 'team_invite_declined'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.americano_participants ap
        WHERE ap.tournament_id = n.entity_id AND ap.user_id = v_uid
      )
      OR EXISTS (
        SELECT 1 FROM public.league_teams lt
        WHERE lt.league_id = n.entity_id
          AND (lt.player1_id = v_uid OR lt.player2_id = v_uid)
      )
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = n.entity_id AND l.created_by = v_uid
      )
    );

  RETURN v_match_count + v_entity_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.kampe_unread_badge_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kampe_unread_badge_count() TO authenticated;

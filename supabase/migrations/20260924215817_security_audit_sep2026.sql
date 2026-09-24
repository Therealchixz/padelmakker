-- Sikkerhedsgennemgang 24. sep. 2026.
--
-- 1) Ingen kan give sig selv admin-rolle, rating eller udelukkelse ved at
--    OPRETTE sin profil.
--    protect_elo_fields kørte kun ved UPDATE. Mangler en bruger sin profil
--    (handle_new_user fejler stille, fx hvis e-mailen allerede står på en
--    anden profil - 6 konti manglede profil ved gennemgangen), kunne brugeren
--    selv indsætte profilen med role = 'admin' og derefter sætte sin egen
--    admin-kode (admin_setup_pin) og få fuld admin-adgang.
--    Nu: ved INSERT fra appen (anon/authenticated, ikke admin) sættes de
--    beskyttede felter altid til standard. Appens egen upsert sender ikke
--    felterne, så intet ændrer sig for normale brugere.
--
-- 2) admin_adjust_elo tjekkede kun admin-rolle, ikke admin-kode (is_admin()).
--    Alle andre admin_*-funktioner kræver koden.
--
-- 3) Beskeder: modtageren må kun markere som læst (og reaktion) - ikke rette
--    indhold, afsender eller modtager. Før kunne modtageren omskrive en
--    besked, så afsenderen så en anden tekst end den, de sendte.
--    Reaktioner går via set_dm_message_reaction (SECURITY DEFINER).
--
-- 4) Interne hjælpefunktioner kan ikke kaldes uden login.

-- 1) -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_elo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'player';
    NEW.elo_rating := 1000;
    NEW.games_played := 0;
    NEW.games_won := 0;
    NEW.americano_elo_rating := 1000;
    NEW.americano_played := 0;
    NEW.is_banned := false;
    NEW.ban_reason := NULL;
    NEW.phone_verification_exempt := false;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF
    NEW.elo_rating IS DISTINCT FROM OLD.elo_rating
    OR NEW.games_played IS DISTINCT FROM OLD.games_played
    OR NEW.games_won IS DISTINCT FROM OLD.games_won
    OR NEW.americano_elo_rating IS DISTINCT FROM OLD.americano_elo_rating
    OR NEW.americano_played IS DISTINCT FROM OLD.americano_played
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
    OR NEW.phone_verification_exempt IS DISTINCT FROM OLD.phone_verification_exempt
  THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_elo_fields_insert ON public.profiles;
CREATE TRIGGER protect_elo_fields_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_elo_fields();

-- 2) -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admins kan dette.';
  END IF;
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);
  IF v_diff <> 0 THEN
    INSERT INTO public.elo_history (user_id, old_rating, new_rating, change, result, date, created_at, match_id)
    VALUES (p_user_id, COALESCE(v_current_elo, 1000), p_new_elo, v_diff, 'adjustment', now(), now(), null);
  END IF;
  PERFORM set_config('app.bypass_elo_protection', 'true', true);
  PERFORM public.recalc_profile_stats_from_elo_history(p_user_id);
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  RETURN v_current_elo;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_adjust_elo(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_elo(uuid, integer) TO authenticated;

-- 3) -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messages_guard_client_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'is_read' - 'reaction') IS DISTINCT FROM (to_jsonb(OLD) - 'is_read' - 'reaction') THEN
    RAISE EXCEPTION 'Kun læst-markering kan ændres på en besked';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.messages_guard_client_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_messages_guard_client_update ON public.messages;
CREATE TRIGGER trg_messages_guard_client_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard_client_update();

-- 4) -------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public._growth_user_qualified(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.americano_internal_tournament_creator(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.americano_internal_tournament_status(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.americano_is_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_players_free_court_side(uuid, integer, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_email_unsub_token() FROM PUBLIC, anon, authenticated;

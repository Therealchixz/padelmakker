-- phone_verification_exempt må kun ændres via admin RPC (protect_elo_fields).

CREATE OR REPLACE FUNCTION public.protect_elo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
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
    OR (
      to_jsonb(NEW) ? 'phone_verification_exempt'
      AND NEW.phone_verification_exempt IS DISTINCT FROM OLD.phone_verification_exempt
    )
  THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_elo_fields_trigger ON public.profiles;
CREATE TRIGGER protect_elo_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_elo_fields();

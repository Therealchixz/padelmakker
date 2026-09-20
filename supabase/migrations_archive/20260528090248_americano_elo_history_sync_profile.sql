-- =============================================================================
-- Sync profiles.americano_elo_rating fra americano_elo_history ved INSERT/UPDATE/DELETE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_americano_elo_history_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  IF uid IS NOT NULL THEN
    PERFORM public.recalc_americano_elo_from_history(uid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.americano_elo_history') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS americano_elo_history_sync_profile ON public.americano_elo_history;
    CREATE TRIGGER americano_elo_history_sync_profile
      AFTER INSERT OR UPDATE OR DELETE ON public.americano_elo_history
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_americano_elo_history_sync_profile();
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.trg_americano_elo_history_sync_profile() FROM PUBLIC;

-- =============================================================================
-- Admin ELO Justering
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_elo int;
  v_first_id uuid;
  v_first_old numeric;
  v_diff numeric;
BEGIN
  -- 1. Sikkerhedstjek: er du admin?
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Adgang nægtet: Kun admins kan justere ELO manuelt.';
  END IF;

  -- 2. Find nuværende beregnet ELO
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  
  -- 3. Find den allerførste historik-række
  SELECT id, old_rating INTO v_first_id, v_first_old
  FROM public.elo_history
  WHERE user_id = p_user_id
    AND old_rating IS NOT NULL
    AND match_id IS NOT NULL
  ORDER BY date ASC, match_id ASC, id ASC
  LIMIT 1;

  IF v_first_id IS NOT NULL THEN
    -- Brugeren HAR kamphistorik. Vi skal forskyde hele historikken
    -- ved at rette i den første rækkes 'old_rating'.
    v_diff := p_new_elo - v_current_elo;
    
    UPDATE public.elo_history
    SET old_rating = old_rating + v_diff
    WHERE id = v_first_id;
    
    -- Triggeren 'elo_history_sync_profile' vil nu automatisk køre 
    -- og opdatere profile.elo_rating korrekt.
  ELSE
    -- Brugeren har INGEN kamphistorik. Vi retter bare direkte i profilen.
    UPDATE public.profiles
    SET elo_rating = p_new_elo
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_elo(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_elo(uuid, int) TO authenticated;

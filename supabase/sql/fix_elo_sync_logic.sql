-- =============================================================================
-- TOTAL ELO FIX & SYNC (Den ultimative løsning)
-- =============================================================================

-- 1. Opdater hoved-funktionen til synkronisering
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delta numeric;
  v_games int;
  v_wins int;
BEGIN
  -- A. Tæl rigtige kampe og sejre
  SELECT 
    COUNT(CASE WHEN match_id IS NOT NULL THEN 1 END)::int,
    COUNT(CASE WHEN match_id IS NOT NULL AND lower(result) = 'win' THEN 1 END)::int
  INTO v_games, v_wins
  FROM public.elo_history
  WHERE user_id = p_user_id;

  -- B. Beregn samlet ELO (Start altid på 1000 + alle ændringer i historikken)
  -- Vi inkluderer alle rækker (også dem uden match_id), så justeringer tæller med.
  SELECT COALESCE(SUM(change::numeric), 0) INTO v_delta 
  FROM public.elo_history 
  WHERE user_id = p_user_id;

  -- C. Opdater profilen
  UPDATE public.profiles SET 
    elo_rating = GREATEST(100, ROUND(1000 + v_delta)::int),
    games_played = COALESCE(v_games, 0),
    games_won = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END; $$;

-- 2. Opdater Admin-justerings funktionen
CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Kun admins kan dette.'; END IF;

  -- Hent nuværende (allerede beregnede) ELO
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);

  IF v_diff = 0 THEN RETURN; END IF;

  -- Vi indsætter en korrektion
  INSERT INTO public.elo_history (
    user_id, change, result, date, created_at, match_id
  ) VALUES (
    p_user_id, v_diff, 'adjustment', now(), now(), null
  );
  
  -- Triggeren elo_history_sync_profile kører nu automatisk og kalder recalc
END; $$;

-- 3. GLOBAL GENBEREGNING (Kør denne del for at fikse alle spillere nu)
-- Denne kommando tvinger en genberegning for hver eneste profil i systemet.
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_profile_stats_from_elo_history(r.id);
  END LOOP;
END $$;

-- Sørg for at rettighederne er på plads
GRANT EXECUTE ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_elo(uuid, int) TO authenticated;

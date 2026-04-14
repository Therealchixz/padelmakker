-- =============================================================================
-- DEEP FIX: ELO-SYNCHRONIZATION & SCHEMA CLEANUP
-- =============================================================================

-- 1. FJERN BEGRÆNSNINGER (Constraints) DER BLOKERER FOR RETTELSER
-- Dette fjerner fejlen "violates check constraint elo_history_result_check"
ALTER TABLE public.elo_history 
  DROP CONSTRAINT IF EXISTS elo_history_result_check;

-- Vi tilføjer den igen, men med 'adjustment' som en tilladt værdi
ALTER TABLE public.elo_history 
  ADD CONSTRAINT elo_history_result_check 
  CHECK (result IN ('win', 'loss', 'draw', 'adjustment'));


-- 2. DEN ENDELIGE GENBEREGNINGS-FUNKTION (Matcher appens logik 100%)
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base_rating numeric;
  v_total_delta numeric;
  v_games int;
  v_wins int;
BEGIN
  -- A. Find spillerens ALLERFØRSTE rating som fundament
  -- Vi sorterer præcis som eloHistoryUtils.js gør i frontend
  SELECT e.old_rating::numeric INTO v_base_rating
  FROM public.elo_history e
  WHERE e.user_id = p_user_id AND e.old_rating IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST
  LIMIT 1;

  -- Hvis ingen historik findes, sætter vi dem til standard 1000/0/0
  IF v_base_rating IS NULL THEN
    UPDATE public.profiles SET 
      elo_rating = 1000, 
      games_played = 0, 
      games_won = 0 
    WHERE id = p_user_id;
    RETURN;
  END IF;

  -- B. Beregn den samlede ændring (sum af alle 'change' kolonner)
  SELECT COALESCE(SUM(change::numeric), 0) INTO v_total_delta
  FROM public.elo_history
  WHERE user_id = p_user_id;

  -- C. Tæl kampe og sejre (kun dem med et match_id)
  SELECT 
    COUNT(CASE WHEN match_id IS NOT NULL THEN 1 END)::int,
    COUNT(CASE WHEN match_id IS NOT NULL AND lower(result) = 'win' THEN 1 END)::int
  INTO v_games, v_wins
  FROM public.elo_history
  WHERE user_id = p_user_id;

  -- D. Opdater profilen med det præcise resultat
  UPDATE public.profiles SET 
    elo_rating = GREATEST(100, ROUND(v_base_rating + v_total_delta)::int),
    games_played = COALESCE(v_games, 0),
    games_won = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END; $$;


-- 3. ADMIN RETTELSE (Håndterer synkronisering med det samme)
-- Returnerer den nye ELO, så vi kan bekræfte det i UI
CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Kun admins kan dette.'; END IF;

  -- Hent præcis nuværende ELO fra profilen
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);

  IF v_diff <> 0 THEN
    INSERT INTO public.elo_history (user_id, change, result, date, created_at, match_id)
    VALUES (p_user_id, v_diff, 'adjustment', now(), now(), null);
  END IF;

  -- Tving en genberegning med det samme for at sikre synkronitet
  PERFORM public.recalc_profile_stats_from_elo_history(p_user_id);
  
  -- Returner den nye værdi
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  RETURN v_current_elo;
END; $$;


-- 4. KØR EN TOTAL SYNKronisering AF ALLE BRUGERE NU
-- Dette fjerner "1000 ELO" fejlen for alle spillere med det samme
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    BEGIN
      PERFORM public.recalc_profile_stats_from_elo_history(r.id);
    EXCEPTION WHEN OTHERS THEN 
      RAISE NOTICE 'Fejl ved synkronisering af bruger %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;


-- SIKKERHED: Giv adgang til de nye funktioner
GRANT EXECUTE ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_elo(uuid, int) TO authenticated;

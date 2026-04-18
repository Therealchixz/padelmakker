-- =============================================================================
-- UNLOCK ELO: BRYD LÅSEN OG TILLAD ADMIN-OVERRULING
-- =============================================================================

-- 1. FJERN DEN HEMMELIGE LÅS (Hvis den findes)
-- Dette fjerner spærringen på selve profiles-tabellen
DROP TRIGGER IF EXISTS protect_elo_fields ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_elo_fields() CASCADE;

-- 2. OPDATER BEREGNEREN TIL AT ACCEPTERE MANUELLE RETTELSER
-- Vi fjerner "match_id IS NOT NULL" kravet i ELO-beregningen
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first numeric;
  v_delta numeric;
  v_games int;
  v_wins int;
BEGIN
  -- A. Tæl rigtige kampe (Her holder vi fast i match_id kravet for statistikkens skyld)
  SELECT COUNT(*)::int INTO v_games FROM public.elo_history 
  WHERE user_id = p_user_id AND match_id IS NOT NULL;

  -- B. Find fundamentet (Første rating - nu også fra manuelle justeringer)
  SELECT e.old_rating::numeric INTO v_first FROM public.elo_history e
  WHERE e.user_id = p_user_id AND e.old_rating IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST LIMIT 1;

  -- C. Beregn samlet ændring (Her fjerner vi match_id spærringen!)
  SELECT COALESCE(SUM(CASE 
    WHEN change IS NOT NULL THEN change::numeric 
    WHEN new_rating IS NOT NULL AND old_rating IS NOT NULL THEN (new_rating - old_rating)::numeric 
    ELSE 0 END), 0) INTO v_delta
  FROM public.elo_history 
  WHERE user_id = p_user_id;

  -- D. Tæl sejre (Kun fra rigtige kampe)
  SELECT COUNT(*)::int INTO v_wins FROM public.elo_history 
  WHERE user_id = p_user_id AND match_id IS NOT NULL AND lower(COALESCE(result, '')) = 'win';

  -- E. Skriv til profilen
  UPDATE public.profiles SET 
    elo_rating = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = COALESCE(v_games, 0),
    games_won = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END; $$;

-- 3. FORBEDRET ADMIN JUSTERING
CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  -- Check admin status (case-insensitive)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin') THEN 
    RAISE EXCEPTION 'Kun admins kan dette.'; 
  END IF;

  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);

  IF v_diff <> 0 THEN
    -- Vi indsætter rettelsen uden match_id (den bliver nu talt med af den nye recalc)
    INSERT INTO public.elo_history (user_id, change, result, date, created_at, match_id)
    VALUES (p_user_id, v_diff, 'adjustment', now(), now(), null);
  END IF;

  -- Kør synkronisering med det samme
  PERFORM public.recalc_profile_stats_from_elo_history(p_user_id);
  
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  RETURN v_current_elo;
END; $$;

-- 4. KØR TOTAL SYNK FOR ALLE (Fjerner 1000 ELO fejlen globalt)
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_profile_stats_from_elo_history(r.id);
  END LOOP;
END $$;

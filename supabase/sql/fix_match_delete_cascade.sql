-- =============================================================================
-- FIX: CASCADE DELETE PÅ KAMPE
-- Dette script sikrer at når en kamp slettes, så slettes alle tilhørende data automatisk.
-- Uden dette vil sletning fejle pga. Foreign Key constraints.
-- =============================================================================

DO $$
BEGIN
    -- 1) match_players -> matches (CASCADE)
    ALTER TABLE public.match_players DROP CONSTRAINT IF EXISTS match_players_match_id_fkey;
    ALTER TABLE public.match_players 
      ADD CONSTRAINT match_players_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

    -- 2) match_results -> matches (CASCADE)
    ALTER TABLE public.match_results DROP CONSTRAINT IF EXISTS match_results_match_id_fkey;
    ALTER TABLE public.match_results 
      ADD CONSTRAINT match_results_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

    -- 3) elo_history -> matches (CASCADE)
    ALTER TABLE public.elo_history DROP CONSTRAINT IF EXISTS elo_history_match_id_fkey;
    ALTER TABLE public.elo_history 
      ADD CONSTRAINT elo_history_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

    -- 4) notifications -> matches (CASCADE eller SET NULL)
    -- Vi sætter den til CASCADE så notifikationer om slettede kampe også forsvinder
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_match_id_fkey;
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Fejl ved opdatering af constraints: %', SQLERRM;
END $$;

-- Fjern den gamle rolle-baserede delete-policy på league_matches.
--
-- 20260919012004 tilføjede league_matches_delete med is_admin(), men den
-- oprindelige lmatches_delete_admin lå stadig ved siden af og tjekkede kun
-- profiles.role = 'admin'. Permissive policies lægges sammen med OR, så den
-- svageste vandt og stramningen var uden virkning.
--
-- league_matches slettes ikke fra klienten nogen steder, så der er ingen
-- flows der påvirkes.

DROP POLICY IF EXISTS lmatches_delete_admin ON public.league_matches;

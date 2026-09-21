-- try_form_match_proposal danner et kampforslag ud fra et spille-oenske og sender
-- match_proposal-notifikationer til de fire den matcher. Den er SECURITY DEFINER og
-- har som den eneste af de notifikations-skabende RPC'er INGEN kontrol af auth.uid().
--
-- Forfatteren mente den skulle vaere intern - der staar
-- "REVOKE ALL ON FUNCTION public.try_form_match_proposal(uuid) FROM PUBLIC" baade i
-- arkivet og i baseline. Men den revoke ramte ved siden af: Supabase giver separat
-- EXECUTE til anon og authenticated paa alle funktioner i public, og den rettighed
-- roeres ikke af en revoke mod PUBLIC. ACL'en var stadig
-- "anon=X | authenticated=X". Hensigten var skrevet ned og fik aldrig virkning,
-- og ingenting sagde fra.
--
-- Konsekvens i praksis: lille. Man skal kende UUID'et paa et aabent play_intent,
-- og handlingen er den systemet selv udfoerer. Men der er ingen grund til at et
-- ikke-logget-ind kald kan udloese notifikationer til fire mennesker.
--
-- Hvorfor revoke og ikke en auth-kontrol inde i funktionen: den kaldes af
-- expire_stale_play_intents(), som koerer som cronjob hvert 15. minut. Dér er
-- auth.uid() NULL. En kontrol ville braekke den selvhelbredende sti. De interne
-- kaldere er SECURITY DEFINER ejet af postgres og beholder deres adgang.
--
-- Kontrolleret foerst: funktionen naevnes ikke i nogen RLS-politik og kaldes ikke
-- fra frontenden.

REVOKE EXECUTE ON FUNCTION public.try_form_match_proposal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.try_form_match_proposal(uuid) FROM authenticated;

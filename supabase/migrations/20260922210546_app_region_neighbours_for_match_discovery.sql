-- Naboregioner: en kamp skal ogsaa kunne ses fra regionen ved siden af.
--
-- notify_match_watchers kraevede hidtil PRAECIS samme region som opretteren. Med
-- 98 brugere fordelt paa syv regioner skar det en i forvejen lille gruppe i syv
-- endnu mindre. Vaerst i hovedstadsomraadet: en kamp i Koebenhavn var usynlig
-- for 22 brugere paa Sjaelland, selv om der kan vaere 30 km imellem dem.
--
-- Hvorfor naboregioner og ikke afstand i kilometer: kun 48 af 98 profiler har
-- en position gemt. Et afstandsfilter ville lukke halvdelen af brugerne ude.
-- Alle 98 har en region. Afstand er en bedre loesning den dag positionerne er
-- der - det her virker i dag.
--
-- Bornholm staar alene med vilje: der er ingen nabo man lige tager over til.

CREATE OR REPLACE FUNCTION public.app_region_neighbours(p_region text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE public.canonical_app_region(p_region)
    WHEN 'Nordjylland'  THEN ARRAY['Nordjylland','Vestjylland','Østjylland']
    WHEN 'Vestjylland'  THEN ARRAY['Vestjylland','Nordjylland','Østjylland','Sydjylland']
    WHEN 'Østjylland'   THEN ARRAY['Østjylland','Nordjylland','Vestjylland','Sydjylland','Fyn']
    WHEN 'Sydjylland'   THEN ARRAY['Sydjylland','Vestjylland','Østjylland','Fyn']
    WHEN 'Fyn'          THEN ARRAY['Fyn','Østjylland','Sydjylland','Sjælland']
    WHEN 'Sjælland'     THEN ARRAY['Sjælland','Fyn','Hovedstaden']
    WHEN 'Hovedstaden'  THEN ARRAY['Hovedstaden','Sjælland']
    WHEN 'Bornholm'     THEN ARRAY['Bornholm']
    ELSE ARRAY[]::text[]
  END;
$fn$;

COMMENT ON FUNCTION public.app_region_neighbours(text) IS
  'Regionen selv plus de regioner man realistisk koerer til for en kamp. Tom liste for ukendt region.';

REVOKE EXECUTE ON FUNCTION public.app_region_neighbours(text) FROM anon;

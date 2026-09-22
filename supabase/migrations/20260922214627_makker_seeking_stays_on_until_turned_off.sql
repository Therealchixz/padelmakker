-- "Jeg soeger makker" udloeb efter 7 dage. Maalt i produktionen: 14 brugere
-- havde sat fluebenet, men kun 1 var inden for de 7 dage. De 13 var forsvundet
-- fra systemet uden at vide det - de havde ikke fortrudt, de havde bare glemt
-- at forny noget, ingen havde fortalt dem skulle fornys.
--
-- Markeringen bliver staaende nu, til man selv slaar den fra. Et aktivt fravalg
-- er tydeligere end en tavs udloeben.
--
-- Friskhed gaar ikke tabt: rangeringen i Find makker vaegter stadig, hvor
-- nyligt nogen har markeret sig (seekingRecencyScore), saa en gammel markering
-- synker ned i listen frem for at forsvinde. Og profilen viser fortsat,
-- hvornaar man begyndte at soege, saa andre selv kan vurdere den.
--
-- KAMP-kanalen er uroert: den udloeber stadig efter 24 timer, og det er rigtigt
-- - en konkret kamp i morgen er ikke aktuel i naeste uge.

CREATE OR REPLACE FUNCTION public.makker_feed_is_active(p_prefs jsonb, p_seeking_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_since timestamptz;
BEGIN
  IF COALESCE((p_prefs->>'feedVisible')::boolean, false) IS NOT TRUE THEN
    RETURN false;
  END IF;

  BEGIN
    v_since := NULLIF(btrim(COALESCE(p_prefs->>'feedVisibleSince', '')), '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_since := NULL;
  END;
  v_since := COALESCE(v_since, p_seeking_at);

  -- Tidspunktet bruges stadig til at vise "soeger siden ..." og til
  -- rangeringen. Det afgoer bare ikke laengere, om man er synlig.
  RETURN v_since IS NOT NULL;
END;
$fn$;

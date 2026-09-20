-- Kræv bekræftet admin-PIN for at slette ligaer og liga-kampe.
--
-- Baggrund: 20260919003124 samlede de overlappende liga-policies uden at ændre
-- adgangen, og noterede at admin-handlinger på ligaer kun krævede rollen, ikke
-- PIN'en. Her strammes den ene handling der ikke kan fortrydes.
--
-- Hvorfor kun sletning: oprettelse og redigering af ligaer sker i den
-- almindelige Liga-fane, som ikke ligger bag AdminPinGate. Et PIN-krav dér
-- ville brække flowet. Sletning sker derimod udelukkende i Admin-fanen
-- (AdminTab.deleteLiga), og den kan kun åbnes efter at admin har låst op med
-- PIN'en. Stramningen koster derfor ingen friktion — admin har allerede en
-- aktiv PIN-session når knappen er synlig.
--
-- Sletning af en liga fjerner også dens hold og kampe, så det er den ene
-- liga-handling der reelt ikke kan fortrydes.
--
-- Opretteren kan fortsat slette sin egen liga uden PIN; det er kun
-- admin-grenen der strammes fra has_admin_role() til is_admin(), som også
-- kræver en bekræftet PIN-session og et JWT under 8 timer.

DROP POLICY IF EXISTS leagues_delete ON public.leagues;
CREATE POLICY leagues_delete
  ON public.leagues FOR DELETE TO authenticated
  USING ((created_by = (select auth.uid())) OR public.is_admin());

-- league_matches slettes ikke fra klienten nogen steder; kun admin-veje findes.
DROP POLICY IF EXISTS league_matches_delete ON public.league_matches;
CREATE POLICY league_matches_delete
  ON public.league_matches FOR DELETE TO authenticated
  USING (public.is_admin());

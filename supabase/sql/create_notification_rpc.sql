-- =============================================================================
-- Notifikationer: RPC så spillere kan underrette hinanden (RLS blokerer direkte insert)
-- =============================================================================
-- Problem: Appen kalder insert på public.notifications med user_id = modtageren.
-- Som almindelig bruger må man typisk kun INSERT med user_id = auth.uid().
-- Derfor fejler "underret opretter når nogen tilmelder sig" stille (console.warn).
--
-- Kør i Supabase → SQL Editor.
--
-- Hvis tabellen mangler, kør først (tilpas hvis I allerede har notifications):
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  /* uuid uden FK hvis public.matches mangler — tilføj FK manuelt hvis ønsket */
  match_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PostgREST: loggede brugere skal kunne SELECT/UPDATE egne rækker (RLS begrænser; INSERT sker via RPC som ejer)
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Valgfrit — live-opdatering af klokken (Database → Replication i Dashboard kan samme ting):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Læs egne (behold hvis I allerede har policies — undgå dubletter)
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT kun via RPC (SECURITY DEFINER) — ingen åben insert-policy nødvendig

-- =============================================================================
-- RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  -- Underret sig selv
  IF p_user_id = (SELECT auth.uid()) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  -- Underret andre kun i kamp-kontekst du er del af
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Manglende match_id for notifikation til anden bruger';
  END IF;

  -- Målbruger skal også være relateret til samme kamp (creator eller deltager).
  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id
      AND m.creator_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Modtager er ikke relateret til denne kamp';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = (SELECT auth.uid())
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) TO authenticated;

-- =============================================================================
-- Tilmelding: underret opretter uden at klienten skal læse matches.creator_id
-- (RLS kan skjule creator_id for andre spillere → ingen notifikation sendt)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join(
  p_match_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_creator uuid;
  v_joiner uuid;
BEGIN
  v_joiner := (SELECT auth.uid());
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RETURN;
  END IF;

  IF v_creator = v_joiner THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_joiner
  ) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_join', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO authenticated;

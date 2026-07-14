-- Notifications table + base RLS (suite part 1).

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  match_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_user_id = auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Manglende match_id for notifikation til anden bruger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

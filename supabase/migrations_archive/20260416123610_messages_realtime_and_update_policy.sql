-- Migration 20260416123610_messages_realtime_and_update_policy
-- Backfilled from sql:recovered/messages_realtime_and_update_policy.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Messages: RLS update policy + realtime publication (idempotent).

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'public.messages findes ikke — springer over';
    RETURN;
  END IF;

  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Brugere kan se egne beskeder" ON public.messages;
  DROP POLICY IF EXISTS "Brugere kan sende beskeder" ON public.messages;
  DROP POLICY IF EXISTS messages_update_read ON public.messages;
  DROP POLICY IF EXISTS "Users see own messages" ON public.messages;
  DROP POLICY IF EXISTS "Authenticated can send" ON public.messages;
  DROP POLICY IF EXISTS "Users mark received messages read" ON public.messages;

  CREATE POLICY "Users see own messages"
    ON public.messages FOR SELECT TO authenticated
    USING (
      sender_id = (SELECT auth.uid())
      OR receiver_id = (SELECT auth.uid())
      OR public.is_admin()
    );

  CREATE POLICY "Authenticated can send"
    ON public.messages FOR INSERT TO authenticated
    WITH CHECK (sender_id = (SELECT auth.uid()));

  CREATE POLICY "Users mark received messages read"
    ON public.messages FOR UPDATE TO authenticated
    USING (receiver_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (receiver_id = (SELECT auth.uid()) OR public.is_admin());

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

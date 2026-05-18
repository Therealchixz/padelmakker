-- =============================================================================
-- Oprydning: dublet RLS-policies på public.messages
-- Kør i Supabase → SQL Editor (idempotent).
-- Beholder kun de 3 policies fra security_hardening_phase2.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'public.messages findes ikke — springer over';
    RETURN;
  END IF;

  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

  -- Gamle / danske / dublet-navne
  DROP POLICY IF EXISTS "Brugere kan se egne beskeder" ON public.messages;
  DROP POLICY IF EXISTS "Brugere kan sende beskeder" ON public.messages;
  DROP POLICY IF EXISTS messages_update_read ON public.messages;

  -- Genopret kanoniske policies (DROP + CREATE = samme regler, friske navne)
  DROP POLICY IF EXISTS "Users see own messages" ON public.messages;
  CREATE POLICY "Users see own messages"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
      sender_id = (SELECT auth.uid())
      OR receiver_id = (SELECT auth.uid())
      OR public.is_admin()
    );

  DROP POLICY IF EXISTS "Authenticated can send" ON public.messages;
  CREATE POLICY "Authenticated can send"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = (SELECT auth.uid()));

  DROP POLICY IF EXISTS "Users mark received messages read" ON public.messages;
  CREATE POLICY "Users mark received messages read"
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (receiver_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (receiver_id = (SELECT auth.uid()) OR public.is_admin());
END
$$;

NOTIFY pgrst, 'reload schema';

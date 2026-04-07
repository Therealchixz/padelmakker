-- Kør hvis notifications allerede findes uden DELETE-policy (slet enkelt / ryd alle i appen)
GRANT DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

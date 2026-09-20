-- Migration 20260416172316_americano_admin_kick
-- Backfilled from sql:americano_admin_kick.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Admin kan fjerne enhver deltager fra en turnering uanset status
DROP POLICY IF EXISTS "americano_participants_admin_delete" ON public.americano_participants;

CREATE POLICY "americano_participants_admin_delete"
  ON public.americano_participants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

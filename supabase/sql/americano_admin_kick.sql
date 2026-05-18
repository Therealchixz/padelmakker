-- Admin kan fjerne enhver deltager fra en turnering uanset status
DROP POLICY IF EXISTS "americano_participants_admin_delete" ON public.americano_participants;

CREATE POLICY "americano_participants_admin_delete"
  ON public.americano_participants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

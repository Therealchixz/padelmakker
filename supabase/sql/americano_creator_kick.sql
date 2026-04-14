-- =============================================================================
-- Americano: opretter kan fjerne andre deltagere under tilmelding
-- Kør i Supabase → SQL Editor. Idempotent.
-- =============================================================================

-- Tillad opretteren at slette enhver deltager fra sin egen turnering
-- (kun under status = 'registration' — started turneringer kan ikke ændres).
DROP POLICY IF EXISTS "americano_participants_creator_delete" ON public.americano_participants;

CREATE POLICY "americano_participants_creator_delete"
  ON public.americano_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.americano_tournaments t
      WHERE t.id = americano_participants.tournament_id
        AND t.creator_id = (SELECT auth.uid())
        AND t.status = 'registration'
    )
  );

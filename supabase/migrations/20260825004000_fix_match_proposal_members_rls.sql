-- match_proposal_members SELECT måtte ikke spørge sig selv: det gav
-- "infinite recursion" og tom forslagsliste, så klik på «I er 4» /
-- «De andre venter» viste «ikke længere aktivt» selv om forslaget levede.

DROP POLICY IF EXISTS match_proposal_members_select_member ON public.match_proposal_members;
CREATE POLICY match_proposal_members_select_member ON public.match_proposal_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

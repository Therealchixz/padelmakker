-- Chat i Americano/Mexicano (ejeren 25. sep. 2026: "americano burde også have
-- en chat, hvor man kan skrive").
--
-- Samme idé som kamp-chatten (match_messages): kun tilmeldte spillere og
-- opretteren kan læse og skrive. Udelukkede kan ikke skrive. Man kan slette
-- sine egne beskeder; admin (med kode) kan slette alle.

CREATE TABLE IF NOT EXISTS public.americano_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.americano_tournaments(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Spiller',
  sender_avatar text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT americano_messages_content_len_chk
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  CONSTRAINT americano_messages_sender_name_len_chk
    CHECK (char_length(sender_name) <= 80)
);

CREATE INDEX IF NOT EXISTS americano_messages_tournament_created_idx
  ON public.americano_messages (tournament_id, created_at);
CREATE INDEX IF NOT EXISTS americano_messages_sender_idx
  ON public.americano_messages (sender_id);

ALTER TABLE public.americano_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.americano_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.americano_messages TO authenticated;

DROP POLICY IF EXISTS americano_messages_select ON public.americano_messages;
CREATE POLICY americano_messages_select ON public.americano_messages
  FOR SELECT TO authenticated
  USING (
    public.americano_is_participant(tournament_id, (SELECT auth.uid()))
    OR public.americano_internal_tournament_creator(tournament_id) = (SELECT auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS americano_messages_insert ON public.americano_messages;
CREATE POLICY americano_messages_insert ON public.americano_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND NOT public.is_banned()
    AND (
      public.americano_is_participant(tournament_id, (SELECT auth.uid()))
      OR public.americano_internal_tournament_creator(tournament_id) = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS americano_messages_delete ON public.americano_messages;
CREATE POLICY americano_messages_delete ON public.americano_messages
  FOR DELETE TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR public.is_admin());

-- Nye beskeder vises med det samme hos de andre (realtime).
DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'americano_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.americano_messages;
  END IF;
END
$pub$;

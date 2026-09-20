-- Liga hold-chat: beskeder til et specifikt hold i en liga (ligesom match chat).
-- Deltagere i ligaen kan skrive til hinandens hold; alle hold i samme liga kan læse tråden.

CREATE TABLE IF NOT EXISTS public.league_team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  sender_avatar text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT league_team_messages_content_len_chk
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS idx_league_team_messages_team_created
  ON public.league_team_messages (team_id, created_at);

CREATE INDEX IF NOT EXISTS idx_league_team_messages_league_id
  ON public.league_team_messages (league_id);

ALTER TABLE public.league_team_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_league_participant(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_teams lt
    WHERE lt.league_id = p_league_id
      AND (lt.player1_id = auth.uid() OR lt.player2_id = auth.uid())
  )
  OR COALESCE(public.is_admin(), false);
$$;

REVOKE ALL ON FUNCTION public.is_league_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_league_participant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.league_team_messages_set_league_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT lt.league_id INTO NEW.league_id
  FROM public.league_teams lt
  WHERE lt.id = NEW.team_id;

  IF NEW.league_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldigt hold';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_league_team_messages_set_league_id ON public.league_team_messages;
CREATE TRIGGER trg_league_team_messages_set_league_id
  BEFORE INSERT ON public.league_team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.league_team_messages_set_league_id();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'league_team_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.league_team_messages';
  END IF;
END $$;

DROP POLICY IF EXISTS league_team_messages_select ON public.league_team_messages;
CREATE POLICY league_team_messages_select
  ON public.league_team_messages
  FOR SELECT
  TO authenticated
  USING (public.is_league_participant(league_id));

DROP POLICY IF EXISTS league_team_messages_insert ON public.league_team_messages;
CREATE POLICY league_team_messages_insert
  ON public.league_team_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND char_length(btrim(content)) BETWEEN 1 AND 1000
    AND public.is_league_participant(league_id)
  );

DROP POLICY IF EXISTS league_team_messages_delete ON public.league_team_messages;
CREATE POLICY league_team_messages_delete
  ON public.league_team_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR COALESCE(public.is_admin(), false)
  );

GRANT SELECT, INSERT, DELETE ON public.league_team_messages TO authenticated;

-- DM + liga-hold chat: rich message types, reactions, inbox preview

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS reaction text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_chk
  CHECK (message_type IN ('text', 'match_invite', 'venue_share', 'time_suggestion'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_reaction_len_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_reaction_len_chk
  CHECK (reaction IS NULL OR char_length(reaction) BETWEEN 1 AND 8);

ALTER TABLE public.league_team_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS reaction text;

ALTER TABLE public.league_team_messages
  DROP CONSTRAINT IF EXISTS league_team_messages_message_type_chk;
ALTER TABLE public.league_team_messages
  ADD CONSTRAINT league_team_messages_message_type_chk
  CHECK (message_type IN ('text', 'match_invite', 'venue_share', 'time_suggestion'));

ALTER TABLE public.league_team_messages
  DROP CONSTRAINT IF EXISTS league_team_messages_reaction_len_chk;
ALTER TABLE public.league_team_messages
  ADD CONSTRAINT league_team_messages_reaction_len_chk
  CHECK (reaction IS NULL OR char_length(reaction) BETWEEN 1 AND 8);

CREATE OR REPLACE FUNCTION public.dm_message_preview(
  p_message_type text,
  p_content text,
  p_payload jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(p_message_type, 'text')
    WHEN 'match_invite' THEN coalesce(p_payload->>'title', '🎾 Kamp-invitation')
    WHEN 'venue_share' THEN coalesce('📍 ' || nullif(p_payload->>'venue', ''), '📍 Bane')
    WHEN 'time_suggestion' THEN coalesce('📅 ' || nullif(p_payload->>'label', ''), '📅 Tidforslag')
    ELSE coalesce(nullif(btrim(p_content), ''), '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_dm_message_reaction(
  p_message_id uuid,
  p_reaction text
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.messages;
  v_uid uuid := auth.uid();
  v_reaction text := nullif(btrim(p_reaction), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF v_reaction IS NOT NULL AND char_length(v_reaction) > 8 THEN
    RAISE EXCEPTION 'Ugyldig reaktion';
  END IF;

  UPDATE public.messages m
  SET reaction = v_reaction
  WHERE m.id = p_message_id
    AND (m.sender_id = v_uid OR m.receiver_id = v_uid)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Besked ikke fundet';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_league_team_message_reaction(
  p_message_id uuid,
  p_reaction text
)
RETURNS public.league_team_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.league_team_messages;
  v_uid uuid := auth.uid();
  v_reaction text := nullif(btrim(p_reaction), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF v_reaction IS NOT NULL AND char_length(v_reaction) > 8 THEN
    RAISE EXCEPTION 'Ugyldig reaktion';
  END IF;

  UPDATE public.league_team_messages m
  SET reaction = v_reaction
  WHERE m.id = p_message_id
    AND public.is_league_participant(m.league_id)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Besked ikke fundet';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_dm_message_reaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_dm_message_reaction(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_league_team_message_reaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_league_team_message_reaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_dm_conversation_summaries(
  p_scan_limit integer DEFAULT 800
)
RETURNS TABLE (
  other_user_id uuid,
  last_message_id uuid,
  last_sender_id uuid,
  last_receiver_id uuid,
  last_content text,
  last_created_at timestamptz,
  last_is_read boolean,
  unread_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_limit integer;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  v_limit := GREATEST(50, LEAST(coalesce(p_scan_limit, 800), 2000));

  RETURN QUERY
  WITH scoped AS (
    SELECT
      m.id,
      m.sender_id,
      m.receiver_id,
      public.dm_message_preview(m.message_type, m.content, m.payload) AS content,
      m.created_at,
      m.is_read
    FROM public.messages m
    WHERE (m.sender_id = v_caller OR m.receiver_id = v_caller)
      AND NOT public.dm_users_blocked(
        v_caller,
        CASE WHEN m.sender_id = v_caller THEN m.receiver_id ELSE m.sender_id END
      )
    ORDER BY m.created_at DESC
    LIMIT v_limit
  ),
  latest AS (
    SELECT DISTINCT ON (
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END
    )
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END AS other_user_id,
      s.id AS last_message_id,
      s.sender_id AS last_sender_id,
      s.receiver_id AS last_receiver_id,
      s.content AS last_content,
      s.created_at AS last_created_at,
      s.is_read AS last_is_read
    FROM scoped s
    ORDER BY
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END,
      s.created_at DESC
  )
  SELECT
    l.other_user_id,
    l.last_message_id,
    l.last_sender_id,
    l.last_receiver_id,
    l.last_content,
    l.last_created_at,
    l.last_is_read,
    (
      SELECT count(*)::bigint
      FROM scoped u
      WHERE u.receiver_id = v_caller
        AND u.sender_id = l.other_user_id
        AND u.is_read = false
    ) AS unread_count
  FROM latest l
  ORDER BY l.last_created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_dm_conversation_summaries(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_dm_conversation_summaries(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

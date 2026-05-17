-- =============================================================================
-- DM blocks + player reports (anmeld til admin)
-- Kør i Supabase → SQL Editor.
-- =============================================================================

-- ── Blocks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid() AND NOT public.is_banned());

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- ── Reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  context text NOT NULL DEFAULT 'dm',
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_reports_no_self CHECK (reporter_id <> reported_id),
  CONSTRAINT user_reports_reason_chk CHECK (
    reason IN ('harassment', 'spam', 'inappropriate', 'other')
  ),
  CONSTRAINT user_reports_status_chk CHECK (
    status IN ('open', 'reviewed', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status_created
  ON public.user_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported
  ON public.user_reports (reported_id, created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_reports_insert_own ON public.user_reports;
CREATE POLICY user_reports_insert_own ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND reported_id <> auth.uid()
    AND NOT public.is_banned()
  );

DROP POLICY IF EXISTS user_reports_select_own ON public.user_reports;
CREATE POLICY user_reports_select_own ON public.user_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS user_reports_admin_all ON public.user_reports;
CREATE POLICY user_reports_admin_all ON public.user_reports
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Helpers ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dm_users_blocked(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = p_user_a AND b.blocked_id = p_user_b)
       OR (b.blocker_id = p_user_b AND b.blocked_id = p_user_a)
  );
$$;

REVOKE ALL ON FUNCTION public.dm_users_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_users_blocked(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig bruger');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke blokere spillere');
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_caller, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  DELETE FROM public.user_blocks
  WHERE blocker_id = v_caller AND blocked_id = p_blocked_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_context text DEFAULT 'dm'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF p_reported_id IS NULL OR p_reported_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig bruger');
  END IF;
  IF p_reason NOT IN ('harassment', 'spam', 'inappropriate', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en gyldig årsag');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke anmelde spillere');
  END IF;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF length(v_details) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beskrivelsen er for lang (max 2000 tegn)');
  END IF;

  INSERT INTO public.user_reports (reporter_id, reported_id, reason, details, context)
  VALUES (
    v_caller,
    p_reported_id,
    p_reason,
    v_details,
    coalesce(nullif(trim(p_context), ''), 'dm')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.report_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, text) TO authenticated;

-- ── Block DM sends ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.messages_enforce_dm_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.dm_users_blocked(NEW.sender_id, NEW.receiver_id) THEN
    RAISE EXCEPTION 'Du kan ikke sende beskeder til denne spiller (blokeret).'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.sender_id AND is_banned = true) THEN
    RAISE EXCEPTION 'Din konto er begrænset.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_enforce_dm_block ON public.messages;
CREATE TRIGGER trg_messages_enforce_dm_block
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_enforce_dm_block();

-- ── Conversation list: hide blocked partners ─────────────────────────────────
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
    SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at, m.is_read
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

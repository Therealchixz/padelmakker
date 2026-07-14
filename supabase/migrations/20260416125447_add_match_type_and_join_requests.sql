-- Migration 20260416125447_add_match_type_and_join_requests
-- Backfilled from sql:add_match_type_and_join_requests.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Add match_type to matches table ('open' = anyone can join, 'closed' = request required)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'open' CHECK (match_type IN ('open', 'closed'));

-- Table for join requests on closed matches
CREATE TABLE IF NOT EXISTS match_join_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_emoji TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE match_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "join_req_select_own" ON match_join_requests
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Creators can see all requests for their matches
CREATE POLICY "join_req_select_creator" ON match_join_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_join_requests.match_id
      AND matches.creator_id = (select auth.uid())
    )
  );

-- Users can create their own requests
CREATE POLICY "join_req_insert" ON match_join_requests
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Creators can approve/reject requests for their matches
CREATE POLICY "join_req_update_creator" ON match_join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_join_requests.match_id
      AND matches.creator_id = (select auth.uid())
    )
  );

-- Users can cancel (delete) their own pending requests
CREATE POLICY "join_req_delete_own" ON match_join_requests
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Admins bypass all RLS
CREATE POLICY "join_req_admin" ON match_join_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_match_join_requests_match_id ON match_join_requests(match_id);
CREATE INDEX IF NOT EXISTS idx_match_join_requests_user_id ON match_join_requests(user_id);

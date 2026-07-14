-- Migration 20260416130533_messages_realtime_replica_identity
-- Backfilled from sql:recovered/messages_realtime_replica_identity.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Realtime DELETE/UPDATE events for DM read receipts.

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages REPLICA IDENTITY FULL;
  END IF;
END
$$;

-- Realtime DELETE/UPDATE events for DM read receipts.

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages REPLICA IDENTITY FULL;
  END IF;
END
$$;

-- =============================================================================
-- Fix: Americano RLS helpers must stay EXECUTE for authenticated
-- invisible_security_hardening.sql revoked these; RLS policies call them on
-- every SELECT → 403 on americano_tournaments / americano_participants.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.americano_internal_tournament_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.americano_internal_tournament_creator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.americano_is_participant(uuid, uuid) TO authenticated;

-- Idempotent: fjern fra anon hvis tidligere bredt givet
REVOKE EXECUTE ON FUNCTION public.americano_internal_tournament_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.americano_internal_tournament_creator(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.americano_is_participant(uuid, uuid) FROM anon;

NOTIFY pgrst, 'reload schema';

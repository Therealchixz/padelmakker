-- =============================================================================
-- Admin-konsol demo-data (rating_admin_flags)
-- Bruges til at se, hvordan Admin-konsolens flag-sektion ser ud med data.
--
-- KØR DEL 1 for at indsætte demo-data.
-- KØR DEL 2 for at rydde demo-data igen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DEL 1: Indsæt demo-flags
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.rating_admin_flags') IS NULL THEN
    RAISE EXCEPTION 'Tabellen public.rating_admin_flags findes ikke. Kør først supabase/sql/elo_guardrails_admin_flags.sql';
  END IF;
END
$$;

-- Ryd tidligere demo-seed først (idempotent)
DELETE FROM public.rating_admin_flags
WHERE reason LIKE '[DEMO] %'
   OR COALESCE(payload->>'demo_seed', '') = 'admin_console_v1';

WITH admin_user AS (
  SELECT p.id
  FROM public.profiles p
  WHERE lower(COALESCE(p.role, '')) = 'admin'
  LIMIT 1
),
seed_rows AS (
  -- 1) ÅBEN / HØJ / 2v2
  SELECT
    '2v2'::text AS source,
    '[DEMO] Uventet stort ELO-hop i 2v2-kamp'::text AS reason,
    'high'::text AS severity,
    'open'::text AS status,
    NULL::uuid AS match_id,
    NULL::uuid AS tournament_id,
    jsonb_build_object(
      'demo_seed', 'admin_console_v1',
      'scenario', 'elo_jump_2v2',
      'expected_delta', 22,
      'actual_delta', 41,
      'note', 'Eksempel på manuel admin-gennemgang'
    ) AS payload,
    now() - interval '18 minutes' AS created_at,
    NULL::uuid AS reviewed_by,
    NULL::timestamptz AS reviewed_at,
    NULL::text AS review_note

  UNION ALL

  -- 2) ÅBEN / MELLEM / AMERICANO
  SELECT
    'americano'::text,
    '[DEMO] Afsluttet turnering gav usædvanlig rating-spredning'::text,
    'medium'::text,
    'open'::text,
    NULL::uuid,
    NULL::uuid,
    jsonb_build_object(
      'demo_seed', 'admin_console_v1',
      'scenario', 'americano_distribution',
      'participants', 8,
      'max_gain', 56,
      'max_loss', -49
    ),
    now() - interval '11 minutes',
    NULL::uuid,
    NULL::timestamptz,
    NULL::text

  UNION ALL

  -- 3) GENNEMGÅET / MELLEM / 2v2
  SELECT
    '2v2'::text,
    '[DEMO] Gentagne resultat-retter inden for kort tid'::text,
    'medium'::text,
    'reviewed'::text,
    NULL::uuid,
    NULL::uuid,
    jsonb_build_object(
      'demo_seed', 'admin_console_v1',
      'scenario', 'frequent_result_edits',
      'edits_in_24h', 3
    ),
    now() - interval '7 minutes',
    (SELECT id FROM admin_user),
    now() - interval '3 minutes',
    'Set af admin: hold øje med nye ændringer på samme kamp.'

  UNION ALL

  -- 4) LUKKET / LAV / AMERICANO
  SELECT
    'americano'::text,
    '[DEMO] Lille afvigelse afrunde-fejl i delta'::text,
    'low'::text,
    'closed'::text,
    NULL::uuid,
    NULL::uuid,
    jsonb_build_object(
      'demo_seed', 'admin_console_v1',
      'scenario', 'rounding_residual',
      'residual', -1
    ),
    now() - interval '2 minutes',
    (SELECT id FROM admin_user),
    now() - interval '1 minutes',
    'Lukket: afvigelse er ufarlig og indenfor forventet afrunding.'
)
INSERT INTO public.rating_admin_flags (
  source,
  reason,
  severity,
  status,
  match_id,
  tournament_id,
  payload,
  created_at,
  reviewed_by,
  reviewed_at,
  review_note
)
SELECT
  source,
  reason,
  severity,
  status,
  match_id,
  tournament_id,
  payload,
  created_at,
  reviewed_by,
  reviewed_at,
  review_note
FROM seed_rows;

SELECT
  COUNT(*)::int AS demo_flags_inserted
FROM public.rating_admin_flags
WHERE COALESCE(payload->>'demo_seed', '') = 'admin_console_v1';

-- -----------------------------------------------------------------------------
-- DEL 2: Ryd demo-flags igen
-- -----------------------------------------------------------------------------
-- Kør denne DELETE separat når du vil fjerne demo-data:
-- DELETE FROM public.rating_admin_flags
-- WHERE reason LIKE '[DEMO] %'
--    OR COALESCE(payload->>'demo_seed', '') = 'admin_console_v1';


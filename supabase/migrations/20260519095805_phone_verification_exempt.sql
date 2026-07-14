-- Migration 20260519095805_phone_verification_exempt
-- Backfilled from sql:phone_verification_exempt.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Per-user undtagelse fra obligatorisk telefon-SMS (fx testkonti).
-- Admin sætter flag via appen (admin_set_phone_verification_exempt) eller denne migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.phone_verification_exempt IS
  'When true, user may use the app without verified phone (admin-only).';

NOTIFY pgrst, 'reload schema';

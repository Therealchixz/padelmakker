-- ─────────────────────────────────────────────────────────────
-- Felter som opret-flowet (CreateAmericanoTournamentForm) skriver til
-- americano_tournaments: pris/betaling, offentlig-flag, niveau-interval
-- og varighed. Idempotent, så en frisk db push kan genskabe skemaet.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.americano_tournaments
  ADD COLUMN IF NOT EXISTS price_per_person numeric(7,2),
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enforce_level_interval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level_min numeric(3,1),
  ADD COLUMN IF NOT EXISTS level_max numeric(3,1),
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 120;

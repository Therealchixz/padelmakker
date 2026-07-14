ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS total_rounds integer;

COMMENT ON COLUMN public.leagues.total_rounds IS
  'Planlagt antal runder for round-robin / turnering.';

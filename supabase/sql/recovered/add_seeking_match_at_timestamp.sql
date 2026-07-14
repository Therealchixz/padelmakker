ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seeking_match_at timestamptz;

COMMENT ON COLUMN public.profiles.seeking_match_at IS
  'Tidspunkt hvor brugeren aktiverede søger makker/kamp (TTL-baseret).';

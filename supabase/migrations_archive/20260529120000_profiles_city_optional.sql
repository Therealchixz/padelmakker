-- Valgfri by på profil (region forbliver i area)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.profiles.city IS 'Valgfri by inden for profiles.area (region).';

-- =============================================================================
-- ADMIN BAN REASON FEATURE
-- =============================================================================

-- 1. Tilføj 'ban_reason' kolonne til profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ban_reason text;

-- (Valgfrit) Hvis du vil rydde op i eksisterende data med stavefejl
-- UPDATE public.profiles SET play_style = 'Allround' WHERE play_style ILIKE 'alround';

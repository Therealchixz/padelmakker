-- =============================================================================
-- ADMIN BAN REASON & TYPO FIX
-- =============================================================================

-- 1. Tilføj 'ban_reason' kolonne til profiles (hvis den ikke findes)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ban_reason text;

-- 2. Ret stavefejl "alround" -> "Allround" i hele databasen
UPDATE public.profiles 
SET play_style = 'Allround' 
WHERE play_style ILIKE 'alround';

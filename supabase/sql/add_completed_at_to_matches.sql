-- Tilføj completed_at til matches tabellen
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Sæt completed_at for eksisterende færdige kampe til deres oprettelsestidspunkt (eller nu)
UPDATE public.matches 
SET completed_at = created_at 
WHERE status = 'completed' AND completed_at IS NULL;

-- Indeks for hurtig sortering i admin panelet
CREATE INDEX IF NOT EXISTS idx_matches_completed_at ON public.matches (completed_at DESC);

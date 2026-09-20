-- ─────────────────────────────────────────────────────────────
-- Kampe-features: 2v2-pris, bane-faciliteter og kampbilleder
-- Anvendt på remote DB 2026-06-15.
-- ─────────────────────────────────────────────────────────────

-- 1) Pris pr. person + betalingsmetode på 2v2-kampe
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS price_per_person numeric(7,2),
  ADD COLUMN IF NOT EXISTS payment_method text;

-- 2) Bane-faciliteter (text[] med kendte nøgler — se src/lib/courtFacilities.jsx)
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS facilities text[] NOT NULL DEFAULT '{}';

UPDATE public.courts
SET facilities = ARRAY['parking','changing_rooms','cafe','pro_shop','showers','wifi']
WHERE name = 'Skansen Padel' AND (facilities IS NULL OR facilities = '{}');

-- 3) Kampbilleder (match_photos) + storage-bucket
CREATE TABLE IF NOT EXISTS public.match_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_photos_match_id_idx ON public.match_photos(match_id);

ALTER TABLE public.match_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_photos_select" ON public.match_photos;
CREATE POLICY "match_photos_select" ON public.match_photos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "match_photos_insert_own" ON public.match_photos;
CREATE POLICY "match_photos_insert_own" ON public.match_photos
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_photos.match_id AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_photos_delete_own" ON public.match_photos;
CREATE POLICY "match_photos_delete_own" ON public.match_photos
  FOR DELETE USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('match-photos', 'match-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "match_photos_upload_own" ON storage.objects;
CREATE POLICY "match_photos_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "match_photos_delete_storage_own" ON storage.objects;
CREATE POLICY "match_photos_delete_storage_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'match-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

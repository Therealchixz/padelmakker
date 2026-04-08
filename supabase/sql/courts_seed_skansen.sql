-- =============================================================================
-- Indsæt Skansen Padel i public.courts (hvis den mangler)
-- =============================================================================
-- Din SELECT viste kun København/Herlev — der er ingen række med Skansen endnu,
-- så "behold kun Skansen"-scriptet kan ikke matche noget før du har oprettet banen.
--
-- 1) Kør denne fil ÉN gang (eller tilpas navn/adresse/pris).
-- 2) Tjek: SELECT id, name, address FROM public.courts WHERE name ILIKE '%skansen%';
-- 3) Kør derefter courts_keep_skansen_only.sql hvis du vil fjerne alle andre baner.
--
-- Kræver kolonnerne booking_url og booking_provider — kør courts_booking_url.sql først
-- hvis de ikke findes.
--
-- Hvis INSERT fejler med "column does not exist": åbn Table Editor → courts og
-- tilpas kolonnelisten (fjern fx rating hvis I ikke har den).
--
-- Pris og rating er eksempler — ret til jeres faktiske timepris.
-- =============================================================================

INSERT INTO public.courts (
  name,
  address,
  is_indoor,
  price_per_hour,
  rating,
  booking_provider,
  booking_url
)
SELECT
  'Skansen Padel',
  'Lerumbakken 11, 9400 Nørresundby',
  true,
  350,
  4.5,
  'halbooking_ntsc',
  'https://ntsc.halbooking.dk/newlook/proc_baner.asp'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.courts c
  WHERE
    c.name ILIKE '%skansen%'
    OR c.name ILIKE '%skånsen%'
    OR c.address ILIKE '%skansen%'
    OR c.address ILIKE '%skånsen%'
);

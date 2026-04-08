/**
 * Eksterne booking-links (fx klubbens Halbooking) — åbnes i ny fane.
 *
 * Prioritet:
 * 1) `booking_url` på `courts` (direkte URL)
 * 2) `booking_provider` = halbooking_ntsc (stabilt, uafhængigt af navn)
 * 3) Navn/adresse m.fl. — case- og diakritik-uafhængig match (fx Skånsen → skansen)
 *
 * Skansen Padel (Nørresundby) bruger samme Halbooking som NTSC.
 */
export const NTSC_HALBOOKING_URL =
  'https://ntsc.halbooking.dk/newlook/proc_baner.asp';

/** Værdier i `booking_provider` der peger på samme Halbooking som NTSC/Skansen. */
const HALBOOKING_NTSC_PROVIDERS = new Set(['halbooking_ntsc', 'ntsc_halbooking']);

/** Nøgleord der efter normalisering findes i banetekst → NTSC Halbooking. */
const HALBOOKING_NTSC_KEYWORDS = ['ntsc', 'skansen', 'skånsen', 'skansan'];

/**
 * Sammenlæg alle relevante tekstfelter (Postgres-kolonner varierer mellem projekter).
 * @param {Record<string, unknown>} court
 */
function courtSearchText(court) {
  const parts = [
    court.name,
    court.address,
    court.description,
    court.city,
    court.region,
    court.notes,
    court.slug,
  ];
  return parts
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x))
    .join(' ');
}

/** Lowercase + fjern diakritiske tegn så "Skånsen" og "Skansen" matcher samme nøgleord. */
function normalizeForKeywordMatch(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {Record<string, unknown> | null | undefined} court — række fra `courts`
 * @returns {string | null}
 */
export function externalBookingUrlForCourt(court) {
  if (!court) return null;
  const direct = court.booking_url;
  if (direct != null && String(direct).trim() !== '') {
    return String(direct).trim();
  }
  const provider = normalizeForKeywordMatch(String(court.booking_provider ?? '').trim());
  if (provider && HALBOOKING_NTSC_PROVIDERS.has(provider.replace(/\s+/g, '_'))) {
    return NTSC_HALBOOKING_URL;
  }
  const hay = normalizeForKeywordMatch(courtSearchText(court));
  if (
    HALBOOKING_NTSC_KEYWORDS.some((k) => hay.includes(normalizeForKeywordMatch(k)))
  ) {
    return NTSC_HALBOOKING_URL;
  }
  return null;
}

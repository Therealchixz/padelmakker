/**
 * Kun disse venue-id må bruges mod Playtomic (SSRF-guard).
 * tenantId + clubSlug er faste — klienten må ikke sende frie URL'er.
 */

export const PLAYTOMIC_VENUE_ALLOWLIST = {
  playtomic_padelboxen: {
    tenantId: 'b8fe7430-f819-4413-b402-a008f94fc2b5',
    clubSlug: 'padelboxen',
    bookingUrl: 'https://playtomic.com/clubs/padelboxen',
  },
  playtomic_padel_dk: {
    tenantId: 'd19c9314-2b4c-4118-8c97-f2eb7a02b5f5',
    clubSlug: 'padel-dk',
    bookingUrl: 'https://playtomic.com/clubs/padel-dk',
  },
  playtomic_the_padel_club_espergaerde: {
    tenantId: 'edf46770-8d23-4ea2-b4fa-226ef3a4e46b',
    clubSlug: 'the-padel-club-espergaerde',
    bookingUrl: 'https://playtomic.com/clubs/the-padel-club-espergaerde',
  },
  playtomic_padel_herlev: {
    tenantId: '99edd047-4bac-48d6-80b5-414ab097f093',
    clubSlug: 'padel-herlev',
    bookingUrl: 'https://playtomic.com/clubs/padel-herlev',
  },
  playtomic_padel6100: {
    tenantId: '2a97fcec-c57d-45dc-9cb3-df8b22c4be72',
    clubSlug: 'padel6100',
    bookingUrl: 'https://playtomic.com/clubs/padel6100',
  },
  playtomic_sambiosen: {
    tenantId: '3ea7289f-7b60-434d-81c9-9b84c7f8e177',
    clubSlug: 'sambiosen',
    bookingUrl: 'https://playtomic.com/clubs/sambiosen',
  },
};

export function getPlaytomicVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return PLAYTOMIC_VENUE_ALLOWLIST[venueId] || null;
}

/**
 * @param {{ clubSlug: string }} cfg
 * @param {string} [dateYmd]
 */
export function playtomicClubDeepUrl(cfg, dateYmd) {
  const base = `https://playtomic.com/clubs/${cfg.clubSlug}`;
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return `${base}?date=${encodeURIComponent(dateYmd)}`;
  }
  return base;
}

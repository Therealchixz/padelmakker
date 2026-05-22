import { DateTime } from 'luxon';
import { BANER_REGION_ORDER } from './banerRegions.js';
import { BANER_VENUES_LINKS } from './banerVenuesLinks.generated.js';

export { BANER_REGION_ORDER };

/**
 * Alle steder under fanen Baner.
 * Halbooking: id → padelmakker-server/halbookingVenuesAllowlist.js
 * Bookli: id → padelmakker-server/bookliAllowlist.js
 * Matchi: id → padelmakker-server/matchiAllowlist.js
 * Link: Padellife-katalog (scripts/build-baner-link-catalog.mjs) — booking uden inline-tider
 */

/** @typedef {{ kind: 'halbooking', id: string, title: string, address: string, indoor: boolean, region: string, note?: string }} HalbookingVenue */
/** @typedef {{ kind: 'bookli', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, infoUrl: string }} BookliVenue */
/** @typedef {{ kind: 'matchi', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, facilityId: string, sport: string, note?: string }} MatchiVenue */
/** @typedef {{ kind: 'link', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, note?: string }} LinkVenue */
/** @typedef {HalbookingVenue | BookliVenue | MatchiVenue | LinkVenue} BanerVenue */

/** Fuldt integrerede centre (ledige tider i app når API tillader det) */
const BANER_VENUES_INTEGRATED = [
  // —— Nordjylland ——
  {
    kind: 'halbooking',
    id: 'skansen_ntsc',
    title: 'Skansen Padel',
    address: 'Lerumbakken 11, 9400 Nørresundby',
    indoor: false,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'padel_lounge_aalborg',
    title: 'Padel Lounge Aalborg',
    address: 'Poul Larsens vej 36, Aalborg',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_aalborg',
    title: 'Match Padel Aalborg',
    address: 'Nibevej 58, 9200 Aalborg',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'bookli',
    id: 'padelpadel_aalborg',
    title: 'PadelPadel Aalborg (AL Bank Arena)',
    address: 'Hellebarden 2, 9230 Svenstrup J',
    indoor: true,
    region: 'Nordjylland',
    bookingUrl: 'https://bookli.app/u/booking/create',
    infoUrl: 'https://padelpadel.dk/vores-centre/aalborg/',
  },
  {
    kind: 'halbooking',
    id: 'himmerland_halbooking',
    title: 'HimmerLand padel (Halbooking)',
    address: 'HimmerLand, Gatten (se himmerland.dk)',
    indoor: false,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'sportshallen_frederikshavn_halbooking',
    title: 'Sportshallen Frederikshavn — padel (Halbooking)',
    address: 'Via Halbooking — Frederikshavn',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_lemvig',
    title: 'Match Padel Lemvig',
    address: 'Nyvang 8, 7620 Lemvig',
    indoor: true,
    region: 'Vestjylland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_hobro',
    title: 'Match Padel Hobro (Sparekassen Danmark Padel)',
    address: 'Jyllandsvej 7, Hobro',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelnord',
    title: 'Padel Nord (MATCHi)',
    address: 'Velkomstcenter Syd 10, 9700 Brønderslev',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2445',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelnord',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel99',
    title: 'Padel99 (MATCHi)',
    address: 'Frederikshavn — matchi.se',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2840',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padel99',
    note:
      'Oversigt hentes fra MATCHi (samme data som på facilitetssiden). Baner vises med sponsor-/bane-navne som på MATCHi. Grøn = ledigt interval — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_skagen_padelcenter',
    title: 'Skagen Padelcenter (MATCHi)',
    address: 'Skagen — matchi.se',
    indoor: false,
    region: 'Nordjylland',
    facilityId: '2430',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter%20',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner facilitetssiden med valgt dato.',
  },
  {
    kind: 'link',
    id: 'aarstennisklub_booking',
    title: 'Aars Tennis & Padel',
    address: 'Aars — se aarstennisklub.dk',
    indoor: false,
    region: 'Nordjylland',
    bookingUrl:
      'https://www.aarstennisklub.dk/Activity/BookingView/Activity2518183623424373632',
    note:
      'På klubbens booking-side vises ledige tider nederst på siden — scroll ned efter du har åbnet linket. PadelMakker viser dem ikke inline.',
  },
  {
    kind: 'link',
    id: 'gug_tennis_padel_booking',
    title: 'Gug Tennis & Padel',
    address: 'Gug, Aalborg — se gugtennisogpadel.dk',
    indoor: true,
    region: 'Nordjylland',
    bookingUrl:
      'https://gugtennisogpadel.memberlink.dk/Activity/BookingView/Activity2520021377950888076',
    note:
      'Ledige tider vises på booking-siden nederst — scroll ned på siden. Tryk Åbn booking (PadelMakker henter ikke kalenderen ind).',
  },

  // —— Østjylland ——
  {
    kind: 'matchi',
    id: 'matchi_padel8500',
    title: 'Padel8500 (MATCHi)',
    address: 'Teknologivej 16, 8500 Grenaa',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2229',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padel8500',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'padelmaster_hadsten',
    title: 'PadelMaster Hadsten (Halbooking)',
    address: 'Toftegårdsvej 28, 8370 Hadsten',
    indoor: true,
    region: 'Østjylland',
  },

  // —— Østjylland (DST: Aarhus, Randers, Horsens, Silkeborg, Djursland m.fl.) ——
  {
    kind: 'halbooking',
    id: 'match_padel_aarhus',
    title: 'Match Padel Aarhus',
    address: 'Sindalsvej 2, 8240 Risskov',
    indoor: true,
    region: 'Østjylland',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelland',
    title: 'Padel Land (MATCHi)',
    address: 'Hjelmagervej 6, 8541 Skødstrup',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2072',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/Padelland',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vipadelaarhus',
    title: 'ViPadel Aarhus (MATCHi)',
    address: 'Holmstrupgårdvej 18A, 8220 Brabrand',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1062',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/ViPadelAarhus',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_silkeborg',
    title: 'Match Padel Silkeborg',
    address: 'Kejlstrupvej 87, 8600 Silkeborg',
    indoor: true,
    region: 'Østjylland',
  },
  {
    kind: 'halbooking',
    id: 'oebg_silkeborg_halbooking',
    title: 'ØBG Tennis & Padel, Silkeborg (Halbooking)',
    address: 'Silkeborg — se øbgtennis.dk',
    indoor: true,
    region: 'Østjylland',
  },

  // —— Vestjylland (DST: Herning, Holstebro, Lemvig, Viborg m.fl.) ——
  {
    kind: 'halbooking',
    id: 'padel_lounge_herning',
    title: 'Padel Lounge Herning (Halbooking)',
    address: 'Godsbanevej 5, Herning',
    indoor: true,
    region: 'Vestjylland',
  },

  // —— Fyn ——
  {
    kind: 'halbooking',
    id: 'match_padel_odense',
    title: 'Match Padel Odense',
    address: 'Petersmindevej 1E, 5000 Odense',
    indoor: true,
    region: 'Fyn',
  },
  {
    kind: 'matchi',
    id: 'matchi_vissenbjerg_padel',
    title: 'Vissenbjerg Padel (MATCHi)',
    address: 'Idrætsvej 3, 5492 Vissenbjerg',
    indoor: true,
    region: 'Fyn',
    facilityId: '3112',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vissenbjergpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_nr_lyndelse_padel',
    title: 'Nr. Lyndelse Padeltennis (MATCHi)',
    address: 'Årslev — matchi.se',
    indoor: false,
    region: 'Fyn',
    facilityId: '870',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/NrLyndelsePadeltennis',
    note: 'Udendørs baner via MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },

  // —— Sønderjylland (syd for Kongeå; ikke Fyn) ——
  {
    kind: 'matchi',
    id: 'matchi_breintholt_esbjerg',
    title: 'Breintholtgård Padel, Esbjerg (MATCHi)',
    address: 'Kokspangvej 17-19, 6710 Esbjerg V',
    indoor: false,
    region: 'Sønderjylland',
    facilityId: '2232',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/breinhotlgardpadel',
    note: 'Udendørs baner via MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_k7_padel_losning',
    title: 'K7 Padel, Løsning (MATCHi)',
    address: 'Lundagervej 57, 8723 Løsning',
    indoor: true,
    region: 'Sønderjylland',
    facilityId: '2650',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/k7-padel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },

  // —— Sjælland ——
  {
    kind: 'halbooking',
    id: 'xpadel_helsingor_halbooking',
    title: 'XPADEL Helsingør (Halbooking)',
    address: 'Helsingør — se xpadel.dk',
    indoor: true,
    region: 'Sjælland',
    note: 'Primært indendørs baner; udendørs bane kan forekomme i kalenderen.',
  },
  {
    kind: 'halbooking',
    id: 'padelpit_roskilde_halbooking',
    title: 'PADELPIT Roskilde (Halbooking)',
    address: 'Københavnsvej 136B, 4000 Roskilde',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'padelpit_karlslunde_halbooking',
    title: 'PADELPIT Karlslunde (Halbooking)',
    address: 'Drejergangen 3D, 2690 Karlslunde',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel4alle',
    title: 'Padel4alle Køge (MATCHi)',
    address: 'Køge — matchi.se',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2364',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/Padel4alle',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelnorth',
    title: 'Padel North Kokkedal (MATCHi)',
    address: 'Kokkedal — matchi.se',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2810',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelnorth',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },

  // —— Hovedstaden ——
  {
    kind: 'matchi',
    id: 'matchi_padelyard',
    title: 'Padel Yard Reffen (MATCHi)',
    address: 'Refshaleøen, København — matchi.se',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '917',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelyard',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vipadelslagelse',
    title: 'VI Padel Slagelse (MATCHi)',
    address: 'Slagelse — matchi.se',
    indoor: true,
    region: 'Sjælland',
    facilityId: '1925',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vipadelslagelse',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'koge_tennis_halbooking',
    title: 'Køge Tennis og Padel Klub (Halbooking)',
    address: 'Køge — koge-tennis.halbooking.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'at_tennis_alleroed',
    title: 'Allerød Tennis & Padel (Halbooking)',
    address: 'Allerød — at-tennis.halbooking.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'tisvilde_tennis_halbooking',
    title: 'Tisvilde Tennis & Padel (Halbooking)',
    address: 'Tisvildeleje — tisvildetennis.halbooking.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'htpk_hillerod_halbooking',
    title: 'Hillerød Tennis & Padelklub (Halbooking)',
    address: 'Hillerød — htpk.halbooking.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_ballerup',
    title: 'Match Padel Ballerup',
    address: 'Ballerup — matchpadel.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_ballerup_single',
    title: 'Match Padel Ballerup (singlebaner)',
    address: 'Ballerup — singlebaner via Match Padel',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_naestved',
    title: 'Match Padel Næstved',
    address: 'Næstved — matchpadel.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_nykobing_falster',
    title: 'Match Padel Nykøbing Falster',
    address: 'Nykøbing Falster — matchpadel.dk',
    indoor: true,
    region: 'Sjælland',
  },
  {
    kind: 'matchi',
    id: 'matchi_racketclub_taastrup',
    title: 'Racket Club Taastrup (MATCHi)',
    address: 'Taastrup — matchi.se',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2262',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/RacketClubTaastrup',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
];

/** Integrerede + Padellife-link-katalog (alle regioner) */
export const BANER_VENUES = [...BANER_VENUES_INTEGRATED, ...BANER_VENUES_LINKS];

/**
 * @param {BanerVenue[]} [venues]
 * @returns {{ region: string, venues: BanerVenue[] }[]}
 */
export function groupBanerVenuesByRegion(venues = BANER_VENUES) {
  /** @type {Map<string, BanerVenue[]>} */
  const map = new Map();
  for (const v of venues) {
    const region = v.region || 'Øvrige';
    if (!map.has(region)) map.set(region, []);
    map.get(region).push(v);
  }

  /** @type {{ region: string, venues: BanerVenue[] }[]} */
  const ordered = [];
  for (const region of BANER_REGION_ORDER) {
    const list = map.get(region);
    if (list?.length) {
      ordered.push({ region, venues: list });
      map.delete(region);
    }
  }
  for (const [region, list] of map) {
    ordered.push({ region, venues: list });
  }
  return ordered;
}

const viteEnv = import.meta.env ?? {};

const SLOTS_BASE =
  (viteEnv.VITE_HALBOOKING_SLOTS_URL && String(viteEnv.VITE_HALBOOKING_SLOTS_URL).trim()) ||
  '/api/halbooking-slots';

const BOOKLI_SLOTS_BASE =
  (viteEnv.VITE_BOOKLI_SLOTS_URL && String(viteEnv.VITE_BOOKLI_SLOTS_URL).trim()) ||
  '/api/bookli-slots';

const MATCHI_SLOTS_BASE =
  (viteEnv.VITE_MATCHI_SLOTS_URL && String(viteEnv.VITE_MATCHI_SLOTS_URL).trim()) ||
  '/api/matchi-slots';

/**
 * @param {string} venueId
 * @param {string} dateYmd
 */
export function matchiSlotsUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('date', dateYmd);
  return `${MATCHI_SLOTS_BASE}?${q.toString()}`;
}

/**
 * @param {{ bookingUrl: string; facilityId: string; sport: string }} v
 * @param {string} dateYmd
 */
export function matchiFacilityDeepUrl(v, dateYmd) {
  const base = String(v.bookingUrl || '').trim();
  if (!base) return '#';
  try {
    const u = new URL(base);
    u.searchParams.set('facilityId', v.facilityId);
    u.searchParams.set('date', dateYmd);
    u.searchParams.set('sport', v.sport);
    u.searchParams.set('week', '');
    u.searchParams.set('year', '');
    return u.toString();
  } catch {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}facilityId=${encodeURIComponent(v.facilityId)}&date=${encodeURIComponent(dateYmd)}&sport=${encodeURIComponent(v.sport)}&week=&year=`;
  }
}

/**
 * @param {string} bookingUrl
 * @param {string} dateYmd
 */
export function memberlinkBookingUrlWithDate(bookingUrl, dateYmd) {
  const base = String(bookingUrl || '').trim();
  if (!base) return '#';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd || '').trim())) return base;
  const d = String(dateYmd).trim();
  try {
    const u = new URL(base);
    if (u.pathname.includes('/Activity/BookingView/')) {
      u.searchParams.set('startDate', d);
      u.searchParams.set('endDate', d);
    }
    return u.toString();
  } catch {
    return base;
  }
}

/**
 * @param {string} venueId
 * @param {string} [dateYmd]
 */
export function halbookingSlotsUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd).trim())) {
    q.set('date', String(dateYmd).trim());
  }
  return `${SLOTS_BASE}?${q.toString()}`;
}

/**
 * @param {string} venueId
 * @param {string} dateYmd
 */
export function bookliSlotsUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('date', dateYmd);
  return `${BOOKLI_SLOTS_BASE}?${q.toString()}`;
}

export function copenhagenDateYmd() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
}

export function copenhagenAddDaysYmd(ymd, deltaDays) {
  const d = DateTime.fromISO(String(ymd || '').trim(), { zone: 'Europe/Copenhagen' });
  if (!d.isValid) return copenhagenDateYmd();
  return d.plus({ days: deltaDays }).toFormat('yyyy-MM-dd');
}

/**
 * @param {string} venueId
 * @param {string} courtName
 * @param {string} time
 */
export function halbookingOpenUrl(venueId, courtName, time) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('pm_bane', courtName);
  q.set('pm_tid', time);
  return `/api/halbooking-open-padel?${q.toString()}`;
}

/**
 * @param {string} venueId
 */
export function halbookingOpenVenueUrl(venueId) {
  return `/api/halbooking-open-padel?venue=${encodeURIComponent(venueId)}`;
}

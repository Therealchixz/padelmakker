import { DateTime } from 'luxon';
import { BANER_REGION_ORDER } from './banerRegions.js';
import { BANER_VENUES_LINKS } from './banerVenuesLinks.generated.js';
import { BANER_VENUE_COORDS } from './banerVenuesCoords.generated.js';
import { filterLinkVenuesWithoutIntegratedDuplicates } from './banerVenueDedup.js';

export { BANER_REGION_ORDER };

/**
 * Alle steder under fanen Baner.
 * Halbooking: id → padelmakker-server/halbookingVenuesAllowlist.js
 * Bookli: id → padelmakker-server/bookliAllowlist.js
 * Matchi: id → padelmakker-server/matchiAllowlist.js
 * Link: Padellife-katalog (scripts/build-baner-link-catalog.mjs) — booking uden inline-tider
 */

/** @typedef {{ kind: 'halbooking', id: string, title: string, address: string, indoor: boolean, region: string, note?: string, latitude?: number, longitude?: number }} HalbookingVenue */
/** @typedef {{ kind: 'bookli', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, infoUrl: string, latitude?: number, longitude?: number }} BookliVenue */
/** @typedef {{ kind: 'matchi', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, facilityId: string, sport: string, note?: string, latitude?: number, longitude?: number }} MatchiVenue */
/** @typedef {{ kind: 'link', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, note?: string, latitude?: number, longitude?: number }} LinkVenue */
/** @typedef {HalbookingVenue | BookliVenue | MatchiVenue | LinkVenue} BanerVenue */

/** @param {BanerVenue} venue */
function attachVenueCoords(venue) {
  const c = BANER_VENUE_COORDS[venue.id];
  if (!c || c.lat == null || c.lng == null) return venue;
  return { ...venue, latitude: c.lat, longitude: c.lng };
}

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
    title: 'Sæby Spektrum & Hostel (padel)',
    address: 'Sæby — bookes via sportshallen.halbooking.dk (Frederikshavn)',
    indoor: true,
    region: 'Nordjylland',
    note:
      'Padel bookes på Sportshallens Halbooking (samme kalender som på sfc.dk). Baner 4–8 er padel — boldmaskinen er ikke en bane.',
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
    address: 'Nordmarksvænget 1, 9990 Skagen',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2430',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter',
    note:
      '4 indendørs padelbaner på MATCHi (plus én udendørs «Other»-bane). Grøn = ledigt — klik åbner MATCHi med valgt dato.',
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
  {
    kind: 'halbooking',
    id: 'padel_lounge_aarhus_halbooking',
    title: 'Padel Lounge Aarhus / Skejby (Halbooking)',
    address: 'Graham Bells Vej 23B, 8200 Aarhus N',
    indoor: true,
    region: 'Østjylland',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelground_aarhus',
    title: 'Padelground Aarhus (MATCHi)',
    address: 'Sylbækvej 17, 8230 Åbyhøj',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1063',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelground',
    note: '5 indendørs baner — bookes via MATCHi (padelground.dk). Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'bjerringbro_padel_halbooking',
    title: 'Bjerringbro Padel (Halbooking)',
    address: 'Bjerringbro — bjerringbroip.halbooking.dk',
    indoor: true,
    region: 'Østjylland',
  },
  {
    kind: 'matchi',
    id: 'matchi_jelling_gormshallen',
    title: 'Jelling Padel / Gormshallen (MATCHi)',
    address: 'Jelling — matchi.se',
    indoor: false,
    region: 'Østjylland',
    facilityId: '1946',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/gormshallen',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel_arena_hedensted',
    title: 'Padel Arena Hedensted (MATCHi)',
    address: 'Hedensted — matchi.se',
    indoor: true,
    region: 'Østjylland',
    facilityId: '766',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelarenahedensted',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
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
  {
    kind: 'matchi',
    id: 'matchi_padelground_viborg',
    title: 'Padelground Viborg (MATCHi)',
    address: 'Gyldenrisvej 9, 8800 Viborg',
    indoor: false,
    region: 'Vestjylland',
    facilityId: '1534',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/PadelgroundViborg',
    note:
      '2 udendørs baner — bookes via MATCHi (som «Book en bane» på padelground.dk). Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'struer_energi_park_halbooking',
    title: 'Struer Energi Park (padel)',
    address: 'Struer — struerhallerne.halbooking.dk',
    indoor: true,
    region: 'Vestjylland',
  },
  {
    kind: 'halbooking',
    id: 'padel_zone_holstebro_halbooking',
    title: 'Padel Zone Holstebro (Halbooking)',
    address: 'Holstebro — padelzone.halbooking.dk',
    indoor: true,
    region: 'Vestjylland',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel_time_norre_nebel',
    title: 'Padel Time Nørre Nebel (MATCHi)',
    address: 'Nørre Nebel — matchi.se',
    indoor: false,
    region: 'Vestjylland',
    facilityId: '1290',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/PadelTimeNorreNebel',
    note: 'Udendørs bane via MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },

  // —— Bornholm ——
  {
    kind: 'halbooking',
    id: 'match_padel_gudhjem',
    title: 'Match Padel Gudhjem',
    address: 'Sportsvænget 16, 3760 Gudhjem',
    indoor: false,
    region: 'Bornholm',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_svaneke',
    title: 'Match Padel Svaneke',
    address: 'Sydskovvej 4, 3740 Svaneke',
    indoor: false,
    region: 'Bornholm',
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
  {
    kind: 'matchi',
    id: 'matchi_odense_padel_center',
    title: 'Odense Padel Center (MATCHi)',
    address: 'Odense — matchi.se/facilities/OPC',
    indoor: true,
    region: 'Fyn',
    facilityId: '989',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/OPC',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },

  // —— Sydjylland (syd for Kongeå; ikke Fyn) ——
  {
    kind: 'link',
    id: 'matchi_breintholt_esbjerg',
    title: 'Breintholtgård Padel, Esbjerg (MATCHi)',
    address: 'Kokspangvej 17-19, 6710 Esbjerg V',
    indoor: false,
    region: 'Sydjylland',
    bookingUrl: 'https://www.matchi.se/facilities/breinhotlgardpadel',
    note: 'Booking via MATCHi — PadelMakker henter ikke ledige tider inline for dette center.',
  },
  {
    kind: 'matchi',
    id: 'matchi_k7_padel_losning',
    title: 'K7 Padel, Løsning (MATCHi)',
    address: 'Lundagervej 57, 8723 Løsning',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2650',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/k7-padel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'halbooking',
    id: 'oksbol_padel_halbooking',
    title: 'Oksbøl Padel Sport (Halbooking)',
    address: 'Riber Arena — blaavandshuk.halbooking.dk',
    indoor: true,
    region: 'Sydjylland',
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
    kind: 'bookli',
    id: 'padelclub_roskilde_bookli',
    title: 'Padel Club Roskilde (Bookli)',
    address: 'Roskilde — padelclub.dk',
    indoor: true,
    region: 'Sjælland',
    bookingUrl: 'https://bookli.app/go/location/ckt1o3a2u11617261da07ieg2nmc',
    infoUrl: 'https://padelclub.dk/roskilde/',
  },
  {
    kind: 'bookli',
    id: 'padelclub_koge_bookli',
    title: 'Padel Club Køge (Bookli)',
    address: 'Køge — padelclub.dk',
    indoor: true,
    region: 'Sjælland',
    bookingUrl: 'https://bookli.app/go/location/cl6kkzj108249110ds68hhwggm8',
    infoUrl: 'https://padelclub.dk/koge',
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
    kind: 'halbooking',
    id: 'atk_arbejdernes_tennisklub_halbooking',
    title: 'Arbejdernes Tennisklub — padel (Halbooking)',
    address: 'København NV — atk.halbooking.dk',
    indoor: true,
    region: 'Hovedstaden',
  },
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
    kind: 'link',
    id: 'matchi_racketclub_taastrup',
    title: 'Racket Club Taastrup (MATCHi)',
    address: 'Taastrup — matchi.se',
    indoor: true,
    region: 'Sjælland',
    bookingUrl: 'https://www.matchi.se/facilities/RacketClubTaastrup',
    note: 'Booking via MATCHi — PadelMakker henter ikke ledige tider inline for dette center.',
  },
  {
    kind: 'matchi',
    id: 'matchi_arenaassens',
    title: 'Arena Assens (MATCHi)',
    address: 'Rådhus Allé 25, 5610, Assens',
    indoor: true,
    region: 'Fyn',
    facilityId: '2823',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/arenaassens',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bki',
    title: 'Barrit Kultur- og Idrætscenter / Barrit GIF (MATCHi)',
    address: 'Kirkebro 4A, 7150, Barrit',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1369',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/BKI',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bogensepadelarena',
    title: 'Bogense Padel Arena (MATCHi)',
    address: 'Gyvelvænget 12, 5400, Bogense',
    indoor: true,
    region: 'Fyn',
    facilityId: '2524',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/bogensepadelarena',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_borrispadeltennis',
    title: 'Borris Padel (MATCHi)',
    address: 'Stadionallé 10, 6900, Skjern',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '1519',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/borrispadeltennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_brenderuppadeltennis',
    title: 'Brenderup Padel Tennis (MATCHi)',
    address: 'Kirkevej 13, 5464, Brenderup',
    indoor: true,
    region: 'Fyn',
    facilityId: '2042',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/brenderuppadeltennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_brolokkepadel',
    title: 'BROLØKKES PADELBANE (MATCHi)',
    address: 'Hedevejen 33, 5932, Humble',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2565',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/brolokkepadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bollemosenpadel',
    title: 'Bøllemosen Padel (MATCHi)',
    address: 'Bøllemosen 4-6, 5771, Stenstrup',
    indoor: true,
    region: 'Fyn',
    facilityId: '2800',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/bollemosenpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_daugardsports',
    title: 'Daugård Idræt (MATCHi)',
    address: 'Gl Vejlevej 47, 8721, Daugård',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2238',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/daugardsports',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_engumuipadel',
    title: 'Engum UI - Padel (MATCHi)',
    address: 'Engum Møllevej 7, 7120, Vejle Øst',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2694',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/engumuipadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_favrskovpadel',
    title: 'Favrskov Padel (MATCHi)',
    address: 'Toftegårdsvej 8, 8370, Hadsten',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1922',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/favrskovpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_fjelleruptennisanl_gpadeltennis',
    title: 'Fjellerup Tennisanlæg Padel & Tennis (MATCHi)',
    address: 'Møllebækvej 2B, 8585 , Glesborg',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1920',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/fjelleruptennisanlægpadeltennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_flowpadelgalten',
    title: 'Flow Padel Galten (MATCHi)',
    address: 'Erhvervsparken Klank 1, 8464, Galten',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '2170',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/FlowPadelGalten',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_faaborgpadelklub',
    title: 'Forum Faaborg Aps - Padel og Golf (MATCHi)',
    address: 'Sundvænget 8, 5600, Faaborg',
    indoor: false,
    region: 'Fyn',
    facilityId: '1475',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/faaborgpadelklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_forumkolding',
    title: 'Forum Kolding Bramdrupdam (MATCHi)',
    address: 'Bramdrupskovvej 110, 6000 Kolding, 6000 , Kolding',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '1439',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/forumkolding',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_farevejleboldklub',
    title: 'Fårevejle Boldklub - Padel (MATCHi)',
    address: 'Fårevejle Kanalvej 11, 4540, Fårevejle',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2421',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/farevejleboldklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_givepadel',
    title: 'Give Padel (MATCHi)',
    address: 'Søndermarken 1, 7323, Give',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '1491',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/givepadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_giryepadeltennis',
    title: 'Gl. Rye Padel & Tennis (MATCHi)',
    address: 'Storesand 17, Gl. Rye, 8680, Ry',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '1857',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/giryepadeltennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_glamsbjergpadel',
    title: 'Glamsbjerg Padel (MATCHi)',
    address: 'Mågevej 4, 5620, Glamsbjerg',
    indoor: true,
    region: 'Fyn',
    facilityId: '2041',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/Glamsbjergpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_grejsstadion',
    title: 'Grejs-Dalen IK Padel (MATCHi)',
    address: 'Vestermarksvej 5 B, 7100, Vejle',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2075',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/grejsstadion',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_halsn_spadelcenter',
    title: 'Halsnæs Padel Center (MATCHi)',
    address: 'Sportsvej 3 , 3300 , Frederiksværk',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2596',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/halsnæspadelcenter',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_haslevpadelklub',
    title: 'Haslev Padel Klub (MATCHi)',
    address: 'Grønlandsgade 3C, 4690 , Haslev',
    indoor: true,
    region: 'Sjælland',
    facilityId: '1591',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/Haslevpadelklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_hedenstedcentretpadel',
    title: 'Hedensted Centret Padel (MATCHi)',
    address: 'Mosetoften 3, 8722, Hedensted',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2307',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/hedenstedcentretpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_hogpadel',
    title: 'HOG Padel (MATCHi)',
    address: 'Ådalsvej 94, 8382, Hinnerup',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1297',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/hogpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_ingstruppadelbane',
    title: 'Ingstrup Padelbane (MATCHi)',
    address: 'Sportsvej 5, 9480 , Løkken',
    indoor: false,
    region: 'Nordjylland',
    facilityId: '2574',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/ingstruppadelbane',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_jebjerglybytennisklub',
    title: 'Jebjerg-Lyby Tennisklub (MATCHi)',
    address: 'Østergade 22 A, Jebjerg, 7870 , Roslev',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '1813',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/jebjerglybytennisklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_jellingpadel',
    title: 'Jelling Padel (MATCHi)',
    address: 'Sydkrogen 10 B, 7300, Jelling',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2412',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/jellingpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_juelsminde',
    title: 'Juelsminde Hallerne (MATCHi)',
    address: 'Tofteskovvej 12 D, 7130 , Juelsminde',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2774',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/juelsminde',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_lunden',
    title: 'Lunden (MATCHi)',
    address: 'Assenbækvej 33, 9700, Brønderslev',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '1981',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/lunden',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_torringifpadel',
    title: 'Middelfart Sparekasse - Tørring Padel (MATCHi)',
    address: 'Kirkevej 10, 7160, Tørring',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2250',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/torringifpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_rcm',
    title: 'MORS PADEL - Sparekassen Danmark Arena (MATCHi)',
    address: 'H C Ørstedsvej 6, 7900, Nykøbing Mors',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '1642',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/rcm',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_s_nders_hallernespadelcenter',
    title: 'Nordfyns Padel Center (MATCHi)',
    address: 'Ullerupvænget 4, 5471, Søndersø',
    indoor: true,
    region: 'Fyn',
    facilityId: '639',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/SøndersøHallernesPadelcenter',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_odensecitypadel',
    title: 'Odense City Padel (MATCHi)',
    address: 'Odense',
    indoor: true,
    region: 'Fyn',
    facilityId: '2226',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/odensecitypadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_skebygf',
    title: 'Otterup Padel v. Skeby GF (MATCHi)',
    address: 'Stadionvej 50 , Otterup, 5450',
    indoor: true,
    region: 'Fyn',
    facilityId: '2290',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/skebygf',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel7500',
    title: 'Padel 7500 (MATCHi)',
    address: 'Lægårdvej 112c, 7500, Holstebro',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '2184',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padel7500',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padeleast',
    title: 'PADEL EAST FREDERIKSSUND (MATCHi)',
    address: 'Centervej 2, 3600, Frederikssund',
    indoor: true,
    region: 'Sjælland',
    facilityId: '1598',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padeleast',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelhornb_k',
    title: 'Padel Hornbæk og Reformer Hornbæk (MATCHi)',
    address: 'Havrevangsvej 1, 3100, Hornbæk',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2585',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelhornbæk',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelprofessorclub',
    title: 'Padel Professor Club (MATCHi)',
    address: 'Elmegårdsvej 5, 8361, Hasselager',
    indoor: true,
    region: 'Østjylland',
    facilityId: '3124',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelprofessorclub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelronnede',
    title: 'Padel Rønnede (MATCHi)',
    address: 'Industrivej 44, 4683, Rønnede',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2310',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelronnede',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelsocialvarlose',
    title: 'Padel Social (MATCHi)',
    address: 'Kirke Værløsevej 58, 3500 , Værløse',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2783',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelsocialvarlose',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelspace',
    title: 'Padel Space (MATCHi)',
    address: 'Vejlbjergvej 31, 8240, Risskov',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1977',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelspace',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padeltonhorning',
    title: 'Padel Tonhøring (MATCHi)',
    address: '8362, Hørning',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2347',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padeltonhorning',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelyardjernbanebyen',
    title: 'Padel Yard Jernbanebyen (MATCHi)',
    address: 'Otto Busses Vej 7X, 2450, København',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2834',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelyardjernbanebyen',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel4540',
    title: 'Padel4540 (MATCHi)',
    address: 'Kalundborgvej 21, 4540, Fårevejle',
    indoor: true,
    region: 'Sjælland',
    facilityId: '3153',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padel4540',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padel4life',
    title: 'Padel4Life (MATCHi)',
    address: 'Odense',
    indoor: true,
    region: 'Fyn',
    facilityId: '2324',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padel4life',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelhall',
    title: 'Padelhall.dk Skive (MATCHi)',
    address: 'Bjørnevej 7b, 7800, Skive',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '481',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelhall.dk',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelhuset',
    title: 'Padelhuset Gilleleje (MATCHi)',
    address: 'Stæremosen 11, 3250, Gilleleje',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2166',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelhuset.dk',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelhusethelsinge',
    title: 'Padelhuset Helsinge (MATCHi)',
    address: 'Bomose Alle 26, 3200, Helsinge',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2388',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/PadelhusetHelsinge',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelsportdk',
    title: 'Padelsport.dk (MATCHi)',
    address: 'Odense',
    indoor: true,
    region: 'Fyn',
    facilityId: '344',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelsportdk',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelstar',
    title: 'Padelstar (MATCHi)',
    address: '8270, Højbjerg',
    indoor: true,
    region: 'Østjylland',
    facilityId: '1747',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelstar',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelworldherning',
    title: 'PadelWorld Herning (MATCHi)',
    address: 'Herning',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '3010',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelworldherning',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelworldikast',
    title: 'PadelWorld Ikast (MATCHi)',
    address: 'La Cours Vej 10, 7430, Ikast',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '3009',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelworldikast',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_pakhus77',
    title: 'Pakhus77 (MATCHi)',
    address: 'Hveensgade 5, 8000, Aarhus C',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2106',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/Pakhus77',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_pjpadel',
    title: 'PJ Padel (MATCHi)',
    address: 'Erhvervsparken 7, 7160, Tørring',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '1962',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/pjpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bannerslundhallen',
    title: 'SEIF Padel (MATCHi)',
    address: 'Grundtvigsvej 73, 9900, Frederikshavn',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2615',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/bannerslundhallen',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_skjerntennisogpadel',
    title: 'Skjern Tennis og Padel Klub (MATCHi)',
    address: 'Skovløkken 4, 6900, Skjern',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '524',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/SkjernTennisogPadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_sk_rb_kpadelogtennis',
    title: 'Skærbækcentret Padel og Tennis (MATCHi)',
    address: 'Storegade 46, 6780 , Skærbæk',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '1940',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/skærbækpadelogtennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_thypadel',
    title: 'Sparekassen Thy Padel Arena (MATCHi)',
    address: 'Vilhelmsborgvej 18, 7700, Thisted',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2323',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/ThyPadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_sportkulturcenterbrovst',
    title: 'Sport & Kulturcenter Brovst (MATCHi)',
    address: 'Damengvej 2, DK9460, Brovst',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '1828',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/sportkulturcenterbrovst',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_tgipadel',
    title: 'TGI Padel (MATCHi)',
    address: 'Bøgeskovvej 37 C, 7000, Fredericia',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2241',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/tgipadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_thyregodpadel',
    title: 'Thyregod Padel (MATCHi)',
    address: 'Thyregodvej 29, 7323 , Give',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2410',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/thyregodpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vedbaekpadelklub',
    title: 'Vedbæk Padel (MATCHi)',
    address: 'Vedbæk Stadion, Gøngehusvej 27, 2950, Vedbæk',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '3180',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vedbaekpadelklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vejlepadelcenter',
    title: 'Vejle Padelcenter (MATCHi)',
    address: 'Hellumvej 7, 7100, Vejle',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2256',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vejlepadelcenter',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vipadelrodovre',
    title: 'ViPadel Rødovre - The Factory (Singlebaner) (MATCHi)',
    address: 'Valhøjs allé 180, 2610, Rødovre',
    indoor: true,
    region: 'Hovedstaden',
    facilityId: '2228',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vipadelrodovre',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vorbassetennispadel',
    title: 'Vorbasse Tennis og Padelklub (MATCHi)',
    address: 'Drivvejen 1, 6623, Vorbasse',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '383',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/VorbasseTennisPadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_wepadel',
    title: 'WePadel (MATCHi)',
    address: 'Hørslevvej 151C, 8462, Harlev',
    indoor: true,
    region: 'Østjylland',
    facilityId: '3038',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/wepadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_westpadelklitmoller',
    title: 'WestPadel Klitmøller (MATCHi)',
    address: 'Vangvej 35, 7700',
    indoor: false,
    region: 'Nordjylland',
    facilityId: '1865',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/westpadelklitmoller',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_westpadelvorupor',
    title: 'WestPadel Vorupør (MATCHi)',
    address: 'Vesterhavsgade 9A, 7700 , Vorupør',
    indoor: false,
    region: 'Nordjylland',
    facilityId: '1866',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/westpadelvorupor',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_orslevidrotsforning',
    title: 'Ørslev Idrætsforening (MATCHi)',
    address: 'Terslevvej 71 b, 4100',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2354',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/orslevidrotsforning',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelaarup',
    title: 'Aarup Padel (MATCHi)',
    address: 'Ormehøjvej 4, 5560, aarup',
    indoor: true,
    region: 'Fyn',
    facilityId: '2612',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelaarup',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_apn',
    title: 'All-Padel - Nakskov (MATCHi)',
    address: 'Søvej 8, 4900, Nakskov',
    indoor: true,
    region: 'Sjælland',
    facilityId: '1912',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/apn',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_aps',
    title: 'All-Padel - Skælskør (MATCHi)',
    address: 'Sorøvej 86, 4230, Skælskør',
    indoor: true,
    region: 'Sjælland',
    facilityId: '1911',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/aps',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_babooncitypadletennis',
    title: 'Baboon City Padel Tennis (MATCHi)',
    address: 'Dueoddevej 5 7400 Herning - Bagved Baboon City - Åkirkebyvej 10, 7400, Herning',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '903',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/BaboonCityPadleTennis',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bankagerpadel',
    title: 'Bankager Padel (MATCHi)',
    address: 'Ternevej 79B, 8700, Horsens',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2437',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/bankagerpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_bryruptennisklub',
    title: 'Bryrup Tennis- & Padelklub (MATCHi)',
    address: 'Sportsvej 20, 8654, Bryrup',
    indoor: true,
    region: 'Vestjylland',
    facilityId: '1150',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/BryrupTennisklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_baringgf',
    title: 'Båring GF (MATCHi)',
    address: 'Kærbyvej 2a, 5466, Asperup',
    indoor: true,
    region: 'Fyn',
    facilityId: '1810',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/baringgf',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_dianalundpadelklub',
    title: 'Dianalund Padel Klub (MATCHi)',
    address: 'Sømosevej 46, 4293, Dianalund',
    indoor: true,
    region: 'Sjælland',
    facilityId: '2501',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/dianalundpadelklub',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_gedvedifpadel',
    title: 'Gedved IF Padel (MATCHi)',
    address: 'Kirkevej 16, 8751, Gedved',
    indoor: true,
    region: 'Østjylland',
    facilityId: '2131',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/gedvedifpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_padelhouse',
    title: 'PadelHouse (MATCHi)',
    address: 'Vejlevangen 13, 5300, Kerteminde',
    indoor: true,
    region: 'Fyn',
    facilityId: '1380',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/padelhouse',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_skylightpadel',
    title: 'SKY-LIGHT Padel (MATCHi)',
    address: 'Snedkervej 5, 6800, Varde',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '2465',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/skylightpadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_sicenter',
    title: 'Skørping Idrætscenter (MATCHi)',
    address: 'Himmerlandsvej 59, 9520, Skørping',
    indoor: true,
    region: 'Nordjylland',
    facilityId: '2313',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/sicenter',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
  {
    kind: 'matchi',
    id: 'matchi_vardepadel',
    title: 'Varde Padel (MATCHi)',
    address: 'Borgpladsen 7, 6800, Varde',
    indoor: true,
    region: 'Sydjylland',
    facilityId: '1728',
    sport: '5',
    bookingUrl: 'https://www.matchi.se/facilities/vardepadel',
    note: 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.',
  },
];

const BANER_VENUES_LINKS_DEDUPED = filterLinkVenuesWithoutIntegratedDuplicates(
  BANER_VENUES_INTEGRATED,
  BANER_VENUES_LINKS
);

/** Integrerede + Padellife-link-katalog (uden dubletter af integrerede navne) */
export const BANER_VENUES = [...BANER_VENUES_INTEGRATED, ...BANER_VENUES_LINKS_DEDUPED].map(
  attachVenueCoords,
);

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

/** @param {string} text */
export function normalizeBanerSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {BanerVenue} venue
 * @param {string} query
 */
export function venueMatchesBanerSearch(venue, query) {
  const q = normalizeBanerSearchText(query.trim());
  if (!q) return true;
  const words = q.split(/\s+/).filter(Boolean);
  const hay = normalizeBanerSearchText(
    [venue.title, venue.address, venue.region, venue.kind, venue.id].filter(Boolean).join(' ')
  );
  return words.every((word) => hay.includes(word));
}

/**
 * @param {{ region: string, venues: BanerVenue[] }[]} groups
 * @param {string} query
 */
export function filterGroupedBanerVenuesBySearch(groups, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return groups;
  return groups
    .map((g) => ({
      region: g.region,
      venues: g.venues.filter((v) => venueMatchesBanerSearch(v, trimmed)),
    }))
    .filter((g) => g.venues.length > 0);
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
 * @param {string} [dateYmd] YYYY-MM-DD — uden denne åbner Halbooking typisk i dag
 */
export function halbookingOpenUrl(venueId, courtName, time, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('pm_bane', courtName);
  q.set('pm_tid', time);
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd).trim())) {
    q.set('date', String(dateYmd).trim());
  }
  return `/api/halbooking-open-padel?${q.toString()}`;
}

/**
 * @param {string} venueId
 * @param {string} [dateYmd] YYYY-MM-DD
 */
export function halbookingOpenVenueUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd).trim())) {
    q.set('date', String(dateYmd).trim());
  }
  return `/api/halbooking-open-padel?${q.toString()}`;
}

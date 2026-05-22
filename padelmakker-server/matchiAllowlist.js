/**
 * Tilladte MATCHi-faciliteter (server-side hentning af /book/schedule HTML).
 */

/** @typedef {{ facilityId: string; sport: string; indoorQuery: string; bookingUrl: string }} MatchiVenueConfig */

/** @type {Record<string, MatchiVenueConfig>} */
export const MATCHI_VENUE_ALLOWLIST = {
  matchi_padel99: {
    facilityId: '2840',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel99',
  },
  matchi_skagen_padelcenter: {
    facilityId: '2430',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter',
  },
  matchi_padelnord: {
    facilityId: '2445',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelnord',
  },
  matchi_padel8500: {
    facilityId: '2229',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel8500',
  },
  matchi_padelland: {
    facilityId: '2072',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Padelland',
  },
  matchi_vipadelaarhus: {
    facilityId: '1062',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/ViPadelAarhus',
  },
  matchi_vissenbjerg_padel: {
    facilityId: '3112',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vissenbjergpadel',
  },
  matchi_k7_padel_losning: {
    facilityId: '2650',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/k7-padel',
  },
  matchi_nr_lyndelse_padel: {
    facilityId: '870',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/NrLyndelsePadeltennis',
  },
  matchi_padelyard: {
    facilityId: '917',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelyard',
  },
  matchi_padel4alle: {
    facilityId: '2364',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Padel4alle',
  },
  matchi_padelnorth: {
    facilityId: '2810',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelnorth',
  },
  matchi_vipadelslagelse: {
    facilityId: '1925',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vipadelslagelse',
  },
  matchi_padelground_viborg: {
    facilityId: '1534',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/PadelgroundViborg',
  },
  matchi_odense_padel_center: {
    facilityId: '989',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/OPC',
  },
  matchi_padel_time_norre_nebel: {
    facilityId: '1290',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/PadelTimeNorreNebel',
  },
  matchi_jelling_gormshallen: {
    facilityId: '1946',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/gormshallen',
  },
  matchi_padel_arena_hedensted: {
    facilityId: '766',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelarenahedensted',
  },
  matchi_padelground_aarhus: {
    facilityId: '1063',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelground',
  },
  matchi_arenaassens: {
    facilityId: '2823',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/arenaassens',
  },
  matchi_bki: {
    facilityId: '1369',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/BKI',
  },
  matchi_bogensepadelarena: {
    facilityId: '2524',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/bogensepadelarena',
  },
  matchi_borrispadeltennis: {
    facilityId: '1519',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/borrispadeltennis',
  },
  matchi_brenderuppadeltennis: {
    facilityId: '2042',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/brenderuppadeltennis',
  },
  matchi_brolokkepadel: {
    facilityId: '2565',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/brolokkepadel',
  },
  matchi_bollemosenpadel: {
    facilityId: '2800',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/bollemosenpadel',
  },
  matchi_daugardsports: {
    facilityId: '2238',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/daugardsports',
  },
  matchi_engumuipadel: {
    facilityId: '2694',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/engumuipadel',
  },
  matchi_favrskovpadel: {
    facilityId: '1922',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/favrskovpadel',
  },
  matchi_fjelleruptennisanl_gpadeltennis: {
    facilityId: '1920',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/fjelleruptennisanlægpadeltennis',
  },
  matchi_flowpadelgalten: {
    facilityId: '2170',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/FlowPadelGalten',
  },
  matchi_faaborgpadelklub: {
    facilityId: '1475',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/faaborgpadelklub',
  },
  matchi_forumkolding: {
    facilityId: '1439',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/forumkolding',
  },
  matchi_farevejleboldklub: {
    facilityId: '2421',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/farevejleboldklub',
  },
  matchi_givepadel: {
    facilityId: '1491',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/givepadel',
  },
  matchi_giryepadeltennis: {
    facilityId: '1857',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/giryepadeltennis',
  },
  matchi_glamsbjergpadel: {
    facilityId: '2041',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Glamsbjergpadel',
  },
  matchi_grejsstadion: {
    facilityId: '2075',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/grejsstadion',
  },
  matchi_halsn_spadelcenter: {
    facilityId: '2596',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/halsnæspadelcenter',
  },
  matchi_haslevpadelklub: {
    facilityId: '1591',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Haslevpadelklub',
  },
  matchi_hedenstedcentretpadel: {
    facilityId: '2307',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/hedenstedcentretpadel',
  },
  matchi_hogpadel: {
    facilityId: '1297',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/hogpadel',
  },
  matchi_ingstruppadelbane: {
    facilityId: '2574',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/ingstruppadelbane',
  },
  matchi_jebjerglybytennisklub: {
    facilityId: '1813',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/jebjerglybytennisklub',
  },
  matchi_jellingpadel: {
    facilityId: '2412',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/jellingpadel',
  },
  matchi_juelsminde: {
    facilityId: '2774',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/juelsminde',
  },
  matchi_lunden: {
    facilityId: '1981',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/lunden',
  },
  matchi_torringifpadel: {
    facilityId: '2250',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/torringifpadel',
  },
  matchi_rcm: {
    facilityId: '1642',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/rcm',
  },
  matchi_s_nders_hallernespadelcenter: {
    facilityId: '639',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/SøndersøHallernesPadelcenter',
  },
  matchi_odensecitypadel: {
    facilityId: '2226',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/odensecitypadel',
  },
  matchi_skebygf: {
    facilityId: '2290',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/skebygf',
  },
  matchi_padel7500: {
    facilityId: '2184',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel7500',
  },
  matchi_padeleast: {
    facilityId: '1598',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padeleast',
  },
  matchi_padelhornb_k: {
    facilityId: '2585',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelhornbæk',
  },
  matchi_padelprofessorclub: {
    facilityId: '3124',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelprofessorclub',
  },
  matchi_padelronnede: {
    facilityId: '2310',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelronnede',
  },
  matchi_padelsocialvarlose: {
    facilityId: '2783',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelsocialvarlose',
  },
  matchi_padelspace: {
    facilityId: '1977',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelspace',
  },
  matchi_padeltonhorning: {
    facilityId: '2347',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padeltonhorning',
  },
  matchi_padelyardjernbanebyen: {
    facilityId: '2834',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelyardjernbanebyen',
  },
  matchi_padel4540: {
    facilityId: '3153',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel4540',
  },
  matchi_padel4life: {
    facilityId: '2324',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel4life',
  },
  matchi_padelhall: {
    facilityId: '481',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelhall.dk',
  },
  matchi_padelhuset: {
    facilityId: '2166',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelhuset.dk',
  },
  matchi_padelhusethelsinge: {
    facilityId: '2388',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/PadelhusetHelsinge',
  },
  matchi_padelsportdk: {
    facilityId: '344',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelsportdk',
  },
  matchi_padelstar: {
    facilityId: '1747',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelstar',
  },
  matchi_padelworldherning: {
    facilityId: '3010',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelworldherning',
  },
  matchi_padelworldikast: {
    facilityId: '3009',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelworldikast',
  },
  matchi_pakhus77: {
    facilityId: '2106',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Pakhus77',
  },
  matchi_pjpadel: {
    facilityId: '1962',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/pjpadel',
  },
  matchi_bannerslundhallen: {
    facilityId: '2615',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/bannerslundhallen',
  },
  matchi_skjerntennisogpadel: {
    facilityId: '524',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/SkjernTennisogPadel',
  },
  matchi_sk_rb_kpadelogtennis: {
    facilityId: '1940',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/skærbækpadelogtennis',
  },
  matchi_thypadel: {
    facilityId: '2323',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/ThyPadel',
  },
  matchi_sportkulturcenterbrovst: {
    facilityId: '1828',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/sportkulturcenterbrovst',
  },
  matchi_tgipadel: {
    facilityId: '2241',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/tgipadel',
  },
  matchi_thyregodpadel: {
    facilityId: '2410',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/thyregodpadel',
  },
  matchi_vedbaekpadelklub: {
    facilityId: '3180',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vedbaekpadelklub',
  },
  matchi_vejlepadelcenter: {
    facilityId: '2256',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vejlepadelcenter',
  },
  matchi_vipadelrodovre: {
    facilityId: '2228',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vipadelrodovre',
  },
  matchi_vorbassetennispadel: {
    facilityId: '383',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/VorbasseTennisPadel',
  },
  matchi_wepadel: {
    facilityId: '3038',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/wepadel',
  },
  matchi_westpadelklitmoller: {
    facilityId: '1865',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/westpadelklitmoller',
  },
  matchi_westpadelvorupor: {
    facilityId: '1866',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/westpadelvorupor',
  },
  matchi_orslevidrotsforning: {
    facilityId: '2354',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/orslevidrotsforning',
  },
  matchi_padelaarup: {
    facilityId: '2612',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelaarup',
  },
  matchi_apn: {
    facilityId: '1912',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/apn',
  },
  matchi_aps: {
    facilityId: '1911',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/aps',
  },
  matchi_babooncitypadletennis: {
    facilityId: '903',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/BaboonCityPadleTennis',
  },
  matchi_bankagerpadel: {
    facilityId: '2437',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/bankagerpadel',
  },
  matchi_bryruptennisklub: {
    facilityId: '1150',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/BryrupTennisklub',
  },
  matchi_baringgf: {
    facilityId: '1810',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/baringgf',
  },
  matchi_dianalundpadelklub: {
    facilityId: '2501',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/dianalundpadelklub',
  },
  matchi_gedvedifpadel: {
    facilityId: '2131',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/gedvedifpadel',
  },
  matchi_padelhouse: {
    facilityId: '1380',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelhouse',
  },
  matchi_skylightpadel: {
    facilityId: '2465',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/skylightpadel',
  },
  matchi_sicenter: {
    facilityId: '2313',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/sicenter',
  },
  matchi_vardepadel: {
    facilityId: '1728',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vardepadel',
  },
};

const MATCHI_ORIGIN = 'https://www.matchi.se';

export function getMatchiVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return MATCHI_VENUE_ALLOWLIST[venueId] || null;
}

export function matchiScheduleUrl(cfg, dateYmd) {
  const q = new URLSearchParams();
  q.set('facilityId', cfg.facilityId);
  q.set('date', dateYmd);
  q.set('sport', cfg.sport);
  q.set('week', '');
  q.set('year', '');
  const tail = cfg.indoorQuery || '';
  return `${MATCHI_ORIGIN}/book/schedule?${q.toString()}${tail ? `&${tail.replace(/^&/, '')}` : ''}`;
}

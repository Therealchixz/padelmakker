/**
 * Verificerede indoor/outdoor for integrerede baner (MATCHi HTML + Halbooking + centrets sider).
 * Kør: npm run audit:venue-indoor
 */

/** @type {Record<string, boolean>} */
export const BANER_INTEGRATED_INDOOR_VERIFIED = {
  // Halbooking
  skansen_ntsc: false,
  padel_lounge_aalborg: true,
  himmerland_halbooking: false,
  sportshallen_frederikshavn_halbooking: true,
  match_padel_aalborg: true,
  match_padel_aarhus: true,
  match_padel_odense: true,
  match_padel_silkeborg: true,
  match_padel_lemvig: true,
  match_padel_hobro: true,
  padelmaster_hadsten: true,
  xpadel_helsingor_halbooking: true,
  padelpit_roskilde_halbooking: true,
  padelpit_karlslunde_halbooking: true,
  oebg_silkeborg_halbooking: true,
  padel_lounge_herning: true,
  koge_tennis_halbooking: true,
  at_tennis_alleroed: true,
  tisvilde_tennis_halbooking: true,
  htpk_hillerod_halbooking: true,
  match_padel_ballerup: true,
  match_padel_ballerup_single: true,
  match_padel_naestved: true,
  match_padel_nykobing_falster: true,

  // Bookli
  padelpadel_aalborg: true,

  // MATCHi (Padel INDOORS / OUTDOORS fra facilitetsside)
  matchi_padel99: true,
  matchi_skagen_padelcenter: true,
  matchi_padelnord: true,
  matchi_padel8500: true,
  matchi_padelland: true,
  matchi_vipadelaarhus: true,
  matchi_vissenbjerg_padel: true,
  matchi_breintholt_esbjerg: false,
  matchi_k7_padel_losning: true,
  matchi_nr_lyndelse_padel: false,
  matchi_padelyard: true,
  matchi_padel4alle: true,
  matchi_padelnorth: true,
  matchi_vipadelslagelse: true,
  matchi_racketclub_taastrup: true,
  matchi_padelground_viborg: false,
};

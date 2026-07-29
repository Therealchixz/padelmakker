/**
 * Kuraterede faciliteter for Baner-centre (samme nøgler som courtFacilities.jsx / kampe-filter).
 * Kilder: MATCHi facility-desc, Match Padel/Smash/PADELPIT/Padel Lounge m.fl. klub-sider
 * (review 2026-07-29). Udvid batchvist — undgå rå scrape uden kontekst-check.
 */

/** @type {Record<string, string[]>} */
export const BANER_VENUE_FACILITIES = {
  link_arhus_padel_lounge_skejby: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  link_ebeltoft_ebeltoft_tennis_klub: ['showers'],
  link_esbjerg_v_breinholtgard_golf_klub: ['parking', 'changing_rooms', 'restaurant', 'pro_shop'],
  link_humleb_k_simons_padel_club: ['parking', 'cafe'],
  link_odder_odder_padel_center: ['changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  link_randers_padel_lounge_randers: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  link_randers_vorup_fb_padel: ['changing_rooms', 'showers'],
  link_snedsted_thy_race_padel: ['parking', 'showers'],
  link_t_nder_padel_club_t_nder: ['changing_rooms', 'showers'],
  link_thisted_thisted_tennis_og_padelklub: ['showers'],
  link_v_ggerl_se_padel_danmark_marielyst: ['parking', 'equipment_rental'],
  link_videb_k_videb_k_lawn_tennis_klub: ['showers'],

  // Match Padel — matchpadel.dk/afdelinger/*
  match_padel_aalborg: ['changing_rooms', 'showers', 'pro_shop', 'equipment_rental'],
  match_padel_aarhus: ['cafe', 'equipment_rental'],
  match_padel_ballerup: ['cafe'],
  match_padel_ballerup_single: ['cafe'],
  match_padel_bornholm_inde: ['cafe', 'equipment_rental'],
  match_padel_bornholm_ude_ronne: ['cafe', 'equipment_rental'],
  match_padel_hobro: ['changing_rooms', 'showers', 'cafe', 'pro_shop', 'equipment_rental'],
  match_padel_klovermarken: ['cafe'],
  match_padel_lemvig: ['equipment_rental'],
  match_padel_naestved: ['changing_rooms', 'showers', 'pro_shop', 'equipment_rental'],
  match_padel_nykobing_falster: ['parking', 'equipment_rental'],
  match_padel_odense: ['parking', 'changing_rooms', 'showers', 'cafe', 'pro_shop', 'equipment_rental'],
  match_padel_silkeborg: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  match_padel_silkeborg_syd: ['changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  match_padel_studio_kbh: ['parking', 'changing_rooms', 'cafe', 'equipment_rental'],

  matchi_bankagerpadel: ['equipment_rental'],
  matchi_baringgf: ['parking'],
  matchi_bogensepadelarena: ['parking'],
  matchi_brolokkepadel: ['parking', 'cafe', 'restaurant', 'equipment_rental'],
  matchi_fjelleruptennisanl_gpadeltennis: ['parking'],
  matchi_forumkolding: ['changing_rooms', 'showers', 'cafe'],
  matchi_glamsbjergpadel: ['changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  matchi_haslevpadelklub: ['showers', 'cafe'],
  matchi_hogpadel: ['parking'],
  matchi_jelling_gormshallen: ['changing_rooms'],
  matchi_jellingpadel: ['parking'],
  matchi_juelsminde: ['parking'],
  matchi_k7_padel_losning: ['changing_rooms', 'showers', 'cafe', 'wifi'],
  matchi_odense_padel_center: ['parking', 'changing_rooms'],
  matchi_odensecitypadel: ['parking'],
  matchi_padel_arena_hedensted: ['changing_rooms', 'showers', 'cafe'],
  matchi_padel4540: ['parking', 'changing_rooms', 'cafe', 'equipment_rental'],
  matchi_padel4life: ['changing_rooms'],
  matchi_padel8500: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  matchi_padelhornb_k: ['parking', 'equipment_rental'],
  matchi_padelhuset: ['changing_rooms', 'cafe'],
  matchi_padelland: ['parking', 'changing_rooms', 'equipment_rental'],
  matchi_padelnord: ['changing_rooms', 'cafe'],
  matchi_padelprofessorclub: ['parking', 'changing_rooms', 'cafe', 'pro_shop'],
  matchi_padelronnede: ['parking', 'equipment_rental'],
  matchi_padelsportdk: ['parking'],
  matchi_padelstar: ['parking', 'cafe'],
  matchi_padelyardjernbanebyen: ['parking', 'changing_rooms', 'equipment_rental'],
  matchi_pakhus77: ['parking', 'changing_rooms', 'showers', 'cafe'],
  matchi_pjpadel: ['parking', 'changing_rooms', 'showers', 'cafe'],
  matchi_s_nders_hallernespadelcenter: ['parking'],
  matchi_sicenter: ['parking'],
  matchi_sk_rb_kpadelogtennis: ['parking', 'cafe', 'restaurant'],
  matchi_sportkulturcenterbrovst: ['changing_rooms'],
  matchi_tgipadel: ['parking'],
  matchi_thyregodpadel: ['equipment_rental'],
  matchi_vardepadel: ['changing_rooms', 'showers', 'cafe'],
  matchi_vipadelrodovre: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  matchi_vipadelslagelse: ['equipment_rental'],
  matchi_vipadelaarhus: ['parking', 'changing_rooms', 'cafe', 'equipment_rental'],
  matchi_vissenbjerg_padel: ['parking'],

  padel_lounge_aalborg: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  padel_lounge_aarhus_halbooking: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  padel_lounge_herning: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  padel_lounge_odense: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  padel_zone_holstebro_halbooking: ['equipment_rental'],
  padelclub_roskilde_bookli: ['changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  padelmaster_hadsten: ['changing_rooms', 'showers', 'cafe'],
  padelpadel_aalborg: ['parking', 'changing_rooms', 'showers', 'pro_shop', 'equipment_rental'],
  padelpit_karlslunde_halbooking: ['parking', 'changing_rooms', 'showers', 'equipment_rental'],
  padelpit_roskilde_halbooking: ['parking', 'changing_rooms', 'showers', 'equipment_rental'],
  skansen_ntsc: ['parking', 'changing_rooms', 'showers', 'cafe', 'pro_shop', 'wifi'],

  // Smash — smash.dk (+ Stensballe)
  smash_horsens_double: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  smash_horsens_single: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  smash_stensballe: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
};

/**
 * @param {{ id: string, facilities?: string[] }} venue
 * @returns {typeof venue & { facilities?: string[] }}
 */
export function attachVenueFacilities(venue) {
  const curatedFacilities = BANER_VENUE_FACILITIES[venue.id];
  if (!curatedFacilities?.length) return venue;
  return { ...venue, facilities: curatedFacilities };
}

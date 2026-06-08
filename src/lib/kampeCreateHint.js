/**
 * Hjælpetekster til tom-tilstande under Kampe — opret via + i toolbar.
 */

export const KAMPE_CREATE_PLUS_HINT = {
  padel: 'Tryk på + øverst til højre for at oprette en kamp.',
  americano: 'Tryk på + øverst til højre for at oprette en Americano/Mexicano.',
  liga: 'Tryk på + øverst til højre for at oprette en liga.',
};

/** Når kanalen har egen opret-knap (fx standalone Liga-fane). */
export const KAMPE_CREATE_STANDALONE_HINT = {
  liga: 'Tryk på Opret liga øverst for at oprette en ny liga.',
  americano: 'Tryk på Opret Americano/Mexicano øverst for at komme i gang.',
};

export function kampeCreateHint(channel, { embedInKampe = true } = {}) {
  if (embedInKampe) return KAMPE_CREATE_PLUS_HINT[channel] || '';
  return KAMPE_CREATE_STANDALONE_HINT[channel] || KAMPE_CREATE_PLUS_HINT[channel] || '';
}

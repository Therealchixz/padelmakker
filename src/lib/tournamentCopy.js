/**
 * Brugertekster for det fælles turneringssystem (Americano + Mexicano).
 * DB/API bruger stadig americano_* — kun labels her.
 */

export const TOURNAMENT_SECTION_LABEL = 'Americano/Mexicano';
export const TOURNAMENT_KAMPE_TAB_LABEL = 'Americano/Mexicano';
export const TOURNAMENT_ELO_LABEL = 'Americano/Mexicano ELO';
export const TOURNAMENT_MODE_LABEL = 'Americano/Mexicano';
export const TOURNAMENT_RANKING_LABEL = 'Americano/Mexicano-ranking';
export const TOURNAMENT_KAMPE_PATH = 'Kampe → Americano/Mexicano';

export const TOURNAMENT_EMPTY = {
  none: 'Ingen Americano/Mexicano endnu',
  noneOpen: 'Ingen åbne Americano/Mexicano',
  nonePlaying: 'Ingen Americano/Mexicano i gang',
  noneCompleted: 'Ingen afsluttede Americano/Mexicano endnu',
  createPrompt: 'Opret en Americano eller Mexicano for at komme i gang.',
  tryOtherTab: 'Prøv en anden statusfane, eller opret en ny Americano/Mexicano.',
};

export const TOURNAMENT_LOADING = 'Indlæser Americano/Mexicano…';
export const TOURNAMENT_LOAD_ERROR_TITLE = 'Kunne ikke hente Americano/Mexicano';
export const TOURNAMENT_LOAD_ERROR_TOAST =
  'Kunne ikke hente Americano/Mexicano. Tjek din forbindelse og prøv igen.';
export const TOURNAMENT_LOGIN_REQUIRED = 'Log ind for at bruge Americano/Mexicano-modulet.';

export const TOURNAMENT_ELO_GRAPH_LABEL = 'Americano/Mexicano ELO';
export const TOURNAMENT_ELO_GRAPH_EMPTY =
  'Afslut mindst 2 Americano/Mexicano for at se din Americano/Mexicano ELO-graf.';
export const TOURNAMENT_DATA_SOURCE = 'Datakilde: Americano og Mexicano';

export const TOURNAMENT_RANKING_ALL_TIME = 'Samlet Americano/Mexicano ELO-rating';
export const TOURNAMENT_RANKING_EMPTY_WEEK = 'Ingen Americano/Mexicano denne uge endnu';
export const TOURNAMENT_RANKING_EMPTY_MONTH = 'Ingen Americano/Mexicano denne måned endnu';
export const TOURNAMENT_RANKING_CTA = 'Afslut en Americano/Mexicano for at komme på ranglisten!';

export const TOURNAMENT_FORM_HINT =
  'Vælg Americano (færdig rundeplan ved start) eller Mexicano (parring efter stilling).';

/** Fallback når navn mangler (notifikationer m.m.). */
export function tournamentDefaultName(tournament) {
  const name = String(tournament?.name || '').trim();
  return name || 'Americano/Mexicano';
}

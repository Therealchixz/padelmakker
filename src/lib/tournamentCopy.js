/**
 * Brugertekster for det fælles turneringssystem (Americano + Mexicano).
 * DB/API bruger stadig americano_* — kun labels her.
 */

export const TOURNAMENT_SECTION_LABEL = 'Turnering';
export const TOURNAMENT_KAMPE_TAB_LABEL = 'Turnering';
export const TOURNAMENT_ELO_LABEL = 'Turnerings-ELO';
export const TOURNAMENT_MODE_LABEL = 'Turnering';
export const TOURNAMENT_RANKING_LABEL = 'Turnerings-ranking';
export const TOURNAMENT_KAMPE_PATH = 'Kampe → Turnering';

export const TOURNAMENT_EMPTY = {
  none: 'Ingen turneringer endnu',
  noneOpen: 'Ingen åbne turneringer',
  nonePlaying: 'Ingen turnering i gang',
  noneCompleted: 'Ingen afsluttede turneringer endnu',
  createPrompt: 'Opret en turnering for at komme i gang.',
  tryOtherTab: 'Prøv en anden statusfane, eller opret en ny turnering.',
};

export const TOURNAMENT_LOADING = 'Indlæser turneringer…';
export const TOURNAMENT_LOAD_ERROR_TITLE = 'Kunne ikke hente turneringer';
export const TOURNAMENT_LOAD_ERROR_TOAST =
  'Kunne ikke hente turneringer. Tjek din forbindelse og prøv igen.';
export const TOURNAMENT_LOGIN_REQUIRED = 'Log ind for at bruge turneringsmodulet.';

export const TOURNAMENT_ELO_GRAPH_LABEL = 'Turnerings-ELO';
export const TOURNAMENT_ELO_GRAPH_EMPTY =
  'Afslut mindst 2 turneringer (Americano eller Mexicano) for at se din Turnerings-ELO-graf.';
export const TOURNAMENT_DATA_SOURCE = 'Datakilde: Americano- og Mexicano-turneringer';

export const TOURNAMENT_RANKING_ALL_TIME = 'Samlet Turnerings-ELO-rating';
export const TOURNAMENT_RANKING_EMPTY_WEEK = 'Ingen turneringer denne uge endnu';
export const TOURNAMENT_RANKING_EMPTY_MONTH = 'Ingen turneringer denne måned endnu';
export const TOURNAMENT_RANKING_CTA = 'Afslut en turnering for at komme på ranglisten!';

export const TOURNAMENT_FORM_HINT =
  'Vælg Americano (færdig rundeplan ved start) eller Mexicano (parring efter stilling).';

/** Fallback når turnering mangler navn (notifikationer m.m.). */
export function tournamentDefaultName(tournament) {
  const name = String(tournament?.name || '').trim();
  return name || 'Turnering';
}

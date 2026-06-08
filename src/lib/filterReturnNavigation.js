/** Hvor filter-sider navigerer tilbage efter gem / annuller. */

export const FILTER_RETURN_PROFIL = '/dashboard/profil';
export const FILTER_RETURN_HJEM = '/dashboard/hjem';
export const FILTER_RETURN_MAKKERE = '/dashboard/makkere';
export const FILTER_RETURN_KAMPE = '/dashboard/kampe';

const ALLOWED = new Set([
  FILTER_RETURN_PROFIL,
  FILTER_RETURN_HJEM,
  FILTER_RETURN_MAKKERE,
  FILTER_RETURN_KAMPE,
]);

export function filterReturnFromState(state) {
  const path = state?.filterReturnTo;
  if (path && ALLOWED.has(path)) return path;
  return FILTER_RETURN_PROFIL;
}

export function filterReturnBackLabel(path) {
  if (path === FILTER_RETURN_HJEM) return 'Hjem';
  if (path === FILTER_RETURN_MAKKERE) return 'Find makker';
  if (path === FILTER_RETURN_KAMPE) return 'Kampe';
  return 'Profil';
}

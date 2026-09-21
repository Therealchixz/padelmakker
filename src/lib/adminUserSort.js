/**
 * Sortering af brugerlisten i admin-panelet.
 *
 * Ligger i lib frem for inde i AdminTab, saa raekkefoelgen kan afproeves med
 * rigtige lister uden at hele admin-panelet skal indlaeses.
 */

/** Admin foerst, saa spillere, saa alt andet. */
const ROLLE_RAEKKEFOELGE = { admin: 1, player: 2 };

/**
 * Datoer sammenlignes som tal, ikke som tekst.
 *
 * Tekstsammenligning ville tilfaeldigvis virke for ISO-strenge, men kun saa
 * laenge ALLE raekker er ISO-strenge. Et Date-objekt eller et tidsstempel ét
 * sted ville give en stille forkert raekkefoelge.
 *
 * @returns {number|null} millisekunder, eller null naar datoen ikke kan laeses
 */
export function signupTime(value) {
  if (value == null || value === '' || value === 0) return null;
  const dt = value instanceof Date ? value : new Date(value);
  const t = dt.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Foerste klik paa en kolonne: hvilken vej skal der sorteres?
 *
 * For datoer er "nyeste foerst" det man vil se i en brugerliste - hvem kom til
 * sidst. For navn, ELO og rolle er stigende det naturlige.
 */
export function firstSortDirection(key) {
  return key === 'created_at' ? 'desc' : 'asc';
}

/**
 * Naeste sorteringstilstand naar man klikker paa en kolonne.
 * Samme kolonne igen vender retningen; en ny kolonne starter forfra.
 */
export function nextSortConfig(current, key) {
  if (current?.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: firstSortDirection(key) };
}

/**
 * Sorteret kopi af brugerlisten. Den oprindelige liste roeres ikke.
 *
 * @param {Array<object>} users
 * @param {{key: string|null, direction: 'asc'|'desc'}} sortConfig
 * @param {(user: object) => string} displayName navnet der vises i listen
 */
export function sortAdminUsers(users, sortConfig, displayName) {
  const liste = Array.isArray(users) ? [...users] : [];
  const key = sortConfig?.key;
  if (!key) return liste;

  const stigende = sortConfig.direction !== 'desc';
  const navn = typeof displayName === 'function' ? displayName : (u) => String(u?.full_name || '');

  liste.sort((a, b) => {
    if (key === 'created_at') {
      const ta = signupTime(a?.created_at);
      const tb = signupTime(b?.created_at);
      // Brugere uden dato skal ligge nederst BEGGE veje. Ellers ville de
      // fylde toppen, hver gang man vender sorteringen.
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return stigende ? ta - tb : tb - ta;
    }

    let aValue;
    let bValue;
    if (key === 'role') {
      aValue = ROLLE_RAEKKEFOELGE[a?.[key]] || 3;
      bValue = ROLLE_RAEKKEFOELGE[b?.[key]] || 3;
    } else if (key === 'full_name') {
      aValue = navn(a).toLowerCase();
      bValue = navn(b).toLowerCase();
    } else {
      aValue = a?.[key] == null ? '' : a[key];
      bValue = b?.[key] == null ? '' : b[key];
    }

    if (aValue < bValue) return stigende ? -1 : 1;
    if (aValue > bValue) return stigende ? 1 : -1;
    return 0;
  });

  return liste;
}

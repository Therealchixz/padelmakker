/** Bevarer Liga-fanens status (Tilmelding/Aktiv/Afsluttede) og scope (Alle/Mine). */
const PREFIX = 'pm-liga-ui:';

export function readLigaSessionPrefs(userId) {
  if (typeof sessionStorage === 'undefined' || !userId) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + String(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function mergeLigaSessionPrefs(userId, partial) {
  if (typeof sessionStorage === 'undefined' || !userId) return;
  try {
    const cur = readLigaSessionPrefs(userId) || {};
    sessionStorage.setItem(PREFIX + String(userId), JSON.stringify({ ...cur, ...partial }));
  } catch { /* private mode / quota */ }
}

/** Genvej fra profil: Mine ligaer → Afsluttede + Mine. */
export function openMineLigaerFromProfile(userId, setTab) {
  mergeLigaSessionPrefs(userId, { ligaView: 'completed', ligaScope: 'mine' });
  setTab('liga');
}

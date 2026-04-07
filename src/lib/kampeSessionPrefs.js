/** Bevarer Kampe/Padel vs Americano + underfaner i samme browser-session (tab/fokus/genindlæsning). */
const PREFIX = "pm-kampe-ui:";

export function readKampeSessionPrefs(userId) {
  if (typeof sessionStorage === "undefined" || !userId) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + String(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function mergeKampeSessionPrefs(userId, partial) {
  if (typeof sessionStorage === "undefined" || !userId) return;
  try {
    const cur = readKampeSessionPrefs(userId) || {};
    sessionStorage.setItem(PREFIX + String(userId), JSON.stringify({ ...cur, ...partial }));
  } catch { /* private mode / quota */ }
}

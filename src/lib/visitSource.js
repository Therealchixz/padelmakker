/**
 * Hvilken mail kom personen fra?
 *
 * Links i mailene har et mærke, fx ?kilde=digest. Ved opstart gemmer appen
 * mærket i sessionStorage og fjerner det fra adressen. Når personen er logget
 * ind (evt. først efter login), sendes det til log_app_return. Så kan vi se,
 * om mailene får folk tilbage.
 *
 * Ingen supabase-import her, så filen kan testes direkte fra node.
 */

export const VISIT_SOURCE_PARAM = 'kilde';
export const VISIT_SOURCE_STORAGE_KEY = 'pm_visit_source';
/** Logger man ikke ind inden for to timer, tæller besøget ikke. */
export const VISIT_SOURCE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function normalizeVisitSource(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(v) ? v : null;
}

/**
 * Læs ?kilde= fra adressen, gem det og fjern det fra adressen.
 * @returns {string | null} mærket, hvis der var et
 */
export function captureVisitSource(loc, storage, history) {
  if (!loc) return null;
  let params;
  try {
    params = new URLSearchParams(loc.search || '');
  } catch {
    return null;
  }
  if (!params.has(VISIT_SOURCE_PARAM)) return null;
  const kilde = normalizeVisitSource(params.get(VISIT_SOURCE_PARAM));
  params.delete(VISIT_SOURCE_PARAM);
  const rest = params.toString();
  const cleanPath = `${loc.pathname || '/'}${rest ? `?${rest}` : ''}${loc.hash || ''}`;
  try {
    history?.replaceState?.(history.state ?? null, '', cleanPath);
  } catch {
    /* adressen bliver bare stående */
  }
  if (!kilde) return null;
  try {
    storage?.setItem(
      VISIT_SOURCE_STORAGE_KEY,
      JSON.stringify({ kilde, path: String(loc.pathname || '/').slice(0, 200), at: Date.now() }),
    );
  } catch {
    /* privat vindue eller blokeret lager: så måler vi ikke dette besøg */
  }
  return kilde;
}

/** @returns {{ kilde: string, path: string } | null} */
export function readPendingVisitSource(storage, now = Date.now()) {
  let raw = null;
  try {
    raw = storage?.getItem(VISIT_SOURCE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const kilde = normalizeVisitSource(v?.kilde);
    const at = Number(v?.at);
    if (!kilde || !Number.isFinite(at) || now - at > VISIT_SOURCE_MAX_AGE_MS || at > now + 60_000) {
      clearPendingVisitSource(storage);
      return null;
    }
    const path = typeof v?.path === 'string' && v.path.startsWith('/') ? v.path.slice(0, 200) : '/';
    return { kilde, path };
  } catch {
    clearPendingVisitSource(storage);
    return null;
  }
}

export function clearPendingVisitSource(storage) {
  try {
    storage?.removeItem(VISIT_SOURCE_STORAGE_KEY);
  } catch {
    /* ignorer */
  }
}

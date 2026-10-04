/**
 * Efter en ny version er lagt ud, kan en åben app prøve at hente en gammel
 * kodefil, der ikke findes længere. iOS melder så "'text/html' is not a valid
 * JavaScript MIME type" (Sentry JAVASCRIPT-REACT-4), og brugeren så "Noget
 * gik galt". I stedet genindlæses siden én gang, så den nye version hentes.
 *
 * Ren logik uden supabase, så den kan testes fra node.
 */

const STALE_CHUNK_PATTERNS = [
  /is not a valid JavaScript MIME type/i,
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
];

export const STALE_CHUNK_RELOAD_KEY = 'pm_stale_chunk_reload_at';
/** Højst én automatisk genindlæsning pr. 30 sek., så vi aldrig ender i et loop. */
export const STALE_CHUNK_RELOAD_COOLDOWN_MS = 30_000;

/*
 * Sat når siden er ved at blive genindlæst pga. en gammel kodefil. Vite giver
 * så den manglende fil videre som `undefined`, og koden der ventede på den
 * fejler med fx "undefined is not an object (evaluating 'e.LandingRoadmap')"
 * (Sentry JAVASCRIPT-REACT-C, 4. okt. 2026). Den fejl er ufarlig — siden
 * genindlæses lige bagefter — så den skal hverken vises eller meldes.
 */
let reloadPending = false;

export function isStaleChunkReloadPending() {
  return reloadPending;
}

export function isStaleChunkError(err) {
  const msg = String(err?.message ?? err ?? '');
  return STALE_CHUNK_PATTERNS.some((re) => re.test(msg));
}

/**
 * Genindlæs siden, hvis fejlen skyldes en gammel kodefil og vi ikke lige har gjort det.
 * @returns {boolean} true hvis siden genindlæses
 */
export function reloadOnceForStaleChunk(err, { storage, reload, now = Date.now() } = {}) {
  if (!isStaleChunkError(err)) return false;
  let last = 0;
  try {
    last = Number(storage?.getItem(STALE_CHUNK_RELOAD_KEY)) || 0;
  } catch {
    /* lageret kan være blokeret */
  }
  if (last && now - last < STALE_CHUNK_RELOAD_COOLDOWN_MS) return false;
  try {
    storage?.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false; // uden lager kan vi ikke garantere, at det ikke looper
  }
  reloadPending = true;
  reload?.();
  return true;
}

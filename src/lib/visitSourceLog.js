import { supabase, isSupabaseConfigured } from './supabase';
import { clearPendingVisitSource, readPendingVisitSource } from './visitSource.js';

function sessionStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

let inFlight = false;

/**
 * Send et gemt mail-mærke (?kilde=...) til log_app_return. Kaldes, når
 * personen er logget ind. Fire-and-forget: fejler det, mærker brugeren intet.
 */
export async function logPendingVisitSource() {
  if (!isSupabaseConfigured || inFlight) return;
  const storage = sessionStore();
  const pending = readPendingVisitSource(storage);
  if (!pending) return;
  inFlight = true;
  try {
    const { error } = await supabase.rpc('log_app_return', {
      p_kilde: pending.kilde,
      p_path: pending.path,
    });
    // Ryd også ved andre fejl end netværk, så vi ikke prøver igen og igen.
    if (!error || !/fetch|network/i.test(String(error.message || ''))) {
      clearPendingVisitSource(storage);
    }
  } catch {
    /* netværk: prøv igen næste gang */
  } finally {
    inFlight = false;
  }
}

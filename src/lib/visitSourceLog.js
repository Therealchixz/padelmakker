import { supabase, isSupabaseConfigured } from './supabase';
import { clearPendingVisitSource, readPendingVisitSource } from './visitSource.js';

function visitStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
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
  const storage = visitStore();
  const pending = readPendingVisitSource(storage);
  if (!pending) return;
  inFlight = true;
  try {
    const { data, error } = await supabase.rpc('log_app_return', {
      p_kilde: pending.kilde,
      p_path: pending.path,
    });
    // Gemt (true) eller en fejl, der ikke er netværk: ryd. Svarer serveren
    // false (fx profilen findes ikke endnu), prøves igen, når den gør.
    if (data === true || (error && !/fetch|network/i.test(String(error.message || '')))) {
      clearPendingVisitSource(storage);
    }
  } catch {
    /* netværk: prøv igen næste gang */
  } finally {
    inFlight = false;
  }
}

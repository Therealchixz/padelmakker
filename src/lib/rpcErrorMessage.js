/** Brugervenlig fejl fra Supabase RPC (inkl. RAISE EXCEPTION fra Postgres). */
export function rpcErrorMessage(error, fallback = 'Ukendt fejl') {
  if (!error) return fallback;
  const msg = String(error.message || error).trim();
  if (/could not find the function|function .* does not exist|schema cache/i.test(msg)) {
    return 'Database-funktionen mangler. Kør det nyeste SQL-script i Supabase SQL Editor.';
  }
  return msg || fallback;
}

/**
 * "Passede niveauet?" efter de første kampe.
 *
 * Niveauet sættes af spilleren selv ved oprettelse, og folk gætter ofte ved
 * siden af (se levelQuiz.js). Efter 1–3 spillede kampe spørger vi én gang:
 * var det for let, passede det, eller var det for svært? Svaret gemmes i
 * brugerens egne kontodata (user_metadata.level_check_at), så kortet ikke
 * kommer igen – heller ikke på en anden telefon.
 *
 * Ingen supabase-import her, så filen kan testes direkte fra node.
 */

export const LEVEL_CHECK_MAX_GAMES = 3;
export const LEVEL_CHECK_STEP = 0.5;

/**
 * @param {{ games_played?: number|null, level?: number|null } | null} profile
 * @param {Record<string, unknown> | null} authMeta user_metadata
 */
export function shouldShowLevelCheck(profile, authMeta) {
  const games = Number(profile?.games_played) || 0;
  if (games < 1 || games > LEVEL_CHECK_MAX_GAMES) return false;
  if (authMeta && authMeta.level_check_at) return false;
  const lvl = Number(profile?.level);
  return Number.isFinite(lvl) && lvl > 0;
}

/**
 * Det niveau, vi foreslår efter svaret, eller null hvis intet skal ændres.
 * @param {number} level nuværende niveau
 * @param {'for_let'|'passede'|'for_svaert'} answer
 */
export function levelCheckSuggestion(level, answer) {
  const lvl = Number(level);
  if (!Number.isFinite(lvl)) return null;
  let next = lvl;
  if (answer === 'for_let') next = Math.min(7, lvl + LEVEL_CHECK_STEP);
  else if (answer === 'for_svaert') next = Math.max(1, lvl - LEVEL_CHECK_STEP);
  else return null;
  next = Math.round(next * 10) / 10;
  return next === lvl ? null : next;
}

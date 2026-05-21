/**
 * Synkroniserer profiles.seeking_match fra kamp- og makker-filter (feedVisible).
 * Letvægts — undgår cirkulære imports mellem filter-moduler.
 */

export function resolveSeekingMatchVisible(matchPrefs, makkerPrefs, profile = {}) {
  const m = typeof matchPrefs === 'object' && matchPrefs != null
    ? matchPrefs
    : (profile?.match_search_prefs && typeof profile.match_search_prefs === 'object'
      ? profile.match_search_prefs
      : {});
  const k = typeof makkerPrefs === 'object' && makkerPrefs != null
    ? makkerPrefs
    : (profile?.makker_search_prefs && typeof profile.makker_search_prefs === 'object'
      ? profile.makker_search_prefs
      : {});
  const mReg = String(m.region || profile?.area || '').trim();
  const kReg = String(k.region || profile?.area || '').trim();
  return Boolean(mReg && m.feedVisible) || Boolean(kReg && k.feedVisible);
}

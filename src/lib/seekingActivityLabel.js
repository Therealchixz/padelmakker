import {
  isProfileMatchFeedVisible,
  isProfileMakkerFeedVisible,
  isSeekingActiveProfile,
  compactMatchSeekingLine,
  compactMakkerSeekingLine,
  seekingChannelDurationLabel,
  channelFeedSince,
} from './seekingFeedTtl.js';
import { normalizeMatchSearchPrefs } from './matchSearchFilterCore.js';
import { normalizeMakkerSearchPrefs } from './makkerSearchFilterCore.js';
import { SEEK_KAMP_TTL_MS, SEEK_MAKKER_TTL_MS } from './platformConstants.js';

export { isProfileMatchFeedVisible, isProfileMakkerFeedVisible, isSeekingActiveProfile };

/** Tekst til aktivitetsfeed, makkerliste m.m. */
export function seekingActivityLabel(profile) {
  const matchOn = isProfileMatchFeedVisible(profile);
  const makkerOn = isProfileMakkerFeedVisible(profile);
  if (matchOn && makkerOn) return 'søger kamp og makker';
  if (makkerOn) return 'søger makker';
  if (matchOn) return 'søger kamp';
  return 'søger kamp';
}

/** Badge/label med stort begyndelsesbogstav (fx «Søger makker»). */
export function seekingActivityLabelDisplay(profile) {
  const text = seekingActivityLabel(profile);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Profil-form til TTL/labels fra aktivitetsfeed-række. */
export function profileShapeForSeekingRow(row) {
  return {
    area: row?.area,
    level: row?.level,
    seeking_match_at: row?.seeking_match_at ?? row?.created_at,
    match_search_prefs: row?.match_search_prefs,
    makker_search_prefs: row?.makker_search_prefs,
  };
}

/** Label til feed-række (én kanal ad gangen når seekingChannel er sat). */
export function seekingActivityLabelForRow(row) {
  if (row?.seekingChannel === 'kamp') return 'søger kamp';
  if (row?.seekingChannel === 'makker') return 'søger makker';
  return seekingActivityLabel(profileShapeForSeekingRow(row));
}

function formatSeekingSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'lige nu';
  if (min < 60) return `${min} min siden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  return `${d} d siden`;
}

function channelSinceIso(prefs, profile, ttlMs) {
  const normalized = prefs;
  const sinceMs = channelFeedSince(normalized, profile?.seeking_match_at);
  if (sinceMs == null || Date.now() - sinceMs >= ttlMs) return null;
  return new Date(sinceMs).toISOString();
}

/**
 * Detaljer til profil-modal — én tydelig blok pr. aktiv kanal (kamp / makker).
 * @param {{ channel?: 'kamp'|'makker' }} [opts] — vis kun den kanal (fx fra aktivitetsfeed «Detaljer»).
 * @returns {null | { blocks: Array<{ type: 'kamp'|'makker', label: string, line: string, duration: string, sinceLabel: string | null }> }}
 */
export function getPlayerSeekingDetails(profile, opts = {}) {
  if (!profile) return null;
  const channel = opts.channel === 'kamp' || opts.channel === 'makker' ? opts.channel : null;
  if (!channel && !isSeekingActiveProfile(profile)) return null;

  const blocks = [];

  if ((!channel || channel === 'kamp') && isProfileMatchFeedVisible(profile)) {
    const prefs = normalizeMatchSearchPrefs(profile.match_search_prefs, profile);
    const sinceIso = channelSinceIso(prefs, profile, SEEK_KAMP_TTL_MS);
    blocks.push({
      type: 'kamp',
      label: 'Søger kamp',
      line: compactMatchSeekingLine(prefs, profile),
      duration: seekingChannelDurationLabel('kamp'),
      sinceLabel: formatSeekingSince(sinceIso),
    });
  }

  if ((!channel || channel === 'makker') && isProfileMakkerFeedVisible(profile)) {
    const prefs = normalizeMakkerSearchPrefs(profile.makker_search_prefs, profile);
    const sinceIso = channelSinceIso(prefs, profile, SEEK_MAKKER_TTL_MS);
    blocks.push({
      type: 'makker',
      label: 'Søger makker',
      line: compactMakkerSeekingLine(prefs, profile),
      duration: seekingChannelDurationLabel('makker'),
      sinceLabel: formatSeekingSince(sinceIso),
    });
  }

  return blocks.length > 0 ? { blocks } : null;
}

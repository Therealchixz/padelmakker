import { absoluteUrl } from './siteMeta';
import { formatMatchDateDa, matchTimeLabel } from './matchDisplayUtils';
import { buildPublicMatchPath, buildPublicTournamentPath } from './publicShareRoutes.js';

/**
 * @typedef {{ ok: boolean; method: 'share' | 'clipboard' | 'none'; error?: string }} ShareResult
 */

/**
 * @param {{ title?: string; text?: string; url?: string }} payload
 * @returns {Promise<ShareResult>}
 */
export async function shareViaWebOrClipboard(payload) {
  const url = payload.url?.trim() || '';
  const text = payload.text?.trim() || '';
  const title = payload.title?.trim() || 'PadelMakker';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text: text || undefined,
        url: url || undefined,
      });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') {
        return { ok: false, method: 'none' };
      }
    }
  }

  const clipboardText = [text, url].filter(Boolean).join('\n\n');
  if (!clipboardText) {
    return { ok: false, method: 'none', error: 'Intet at dele' };
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(clipboardText);
      return { ok: true, method: 'clipboard' };
    }
  } catch {
    /* fallback below */
  }

  return { ok: false, method: 'none', error: 'Deling ikke understøttet' };
}

/** @returns {Promise<ShareResult>} */
export async function shareInviteFriendToApp() {
  const url = absoluteUrl('/opret');
  return shareViaWebOrClipboard({
    title: 'PadelMakker — find padel-makker',
    text:
      'Jeg bruger PadelMakker til at finde padel-makker på mit niveau, oprette kampe og følge ELO. Opret gratis profil her:',
    url,
  });
}

/**
 * @param {object} options
 * @param {object} options.match
 * @param {string} [options.hostName]
 * @returns {Promise<ShareResult>}
 */
export async function sharePadelMatch({ match, hostName }) {
  if (!match?.id) {
    return { ok: false, method: 'none', error: 'Kamp mangler' };
  }

  const dateTxt = match.date ? formatMatchDateDa(match.date) : '';
  const timeTxt = match.time ? matchTimeLabel(match.time) : '';
  const court = match.court_name || 'padel';
  const when = [dateTxt, timeTxt].filter(Boolean).join(' kl. ');
  const host = hostName?.trim() || 'En spiller';

  const url = absoluteUrl(buildPublicMatchPath(String(match.id)));
  const text = [
    `${host} inviterer dig til en padel-kamp på ${court}${when ? ` (${when})` : ''}.`,
    'Log ind eller opret gratis profil på PadelMakker for at se kampen og tilmelde dig:',
  ].join('\n');

  return shareViaWebOrClipboard({
    title: 'Padel-kamp på PadelMakker',
    text,
    url,
  });
}

/**
 * @param {{ tournament: { id: string, name?: string, tournament_date?: string, time_slot?: string, court_name?: string }, hostName?: string }} options
 * @returns {Promise<ShareResult>}
 */
export async function shareAmericanoTournament({ tournament, hostName }) {
  if (!tournament?.id) {
    return { ok: false, method: 'none', error: 'Turnering mangler' };
  }

  const dateTxt = tournament.tournament_date ? formatMatchDateDa(tournament.tournament_date) : '';
  const timeTxt = tournament.time_slot ? String(tournament.time_slot).trim() : '';
  const court = tournament.court_name || 'padel';
  const when = [dateTxt, timeTxt ? `kl. ${timeTxt}` : ''].filter(Boolean).join(' ');
  const host = hostName?.trim() || 'En spiller';
  const title = tournament.name?.trim() || 'Americano/Mexicano';

  const url = absoluteUrl(buildPublicTournamentPath(String(tournament.id)));
  const text = [
    `${host} inviterer dig til "${title}"${when ? ` (${when})` : ''} på ${court}.`,
    'Opret gratis profil på PadelMakker for at tilmelde dig:',
  ].join('\n');

  return shareViaWebOrClipboard({
    title: `${title} · PadelMakker`,
    text,
    url,
  });
}

export { shareResultToastMessage } from './shareFeedback';

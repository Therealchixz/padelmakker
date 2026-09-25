import { absoluteUrl, SITE_ORIGIN } from './siteMeta';
import { buildMatchShareText, shareMatchUrl } from './matchShareText.js';
import { buildTournamentShareText, shareTournamentUrl, tournamentFormatLabel } from './tournamentShareText.js';

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
 * @returns {Promise<ShareResult>}
 */
export async function sharePadelMatch({ match }) {
  if (!match?.id) {
    return { ok: false, method: 'none', error: 'Kamp mangler' };
  }
  // Tekst og link hver for sig: så laver Messenger et kort med kampens dato,
  // niveau og ledige pladser (api/kamp-preview) og lægger teksten under.
  // 24. sep. stod linket i teksten, fordi Vercels robotværn blokerede
  // Facebook, så kortet var tomt. Værnet er slået fra 25. sep. 2026.
  return shareViaWebOrClipboard({
    title: 'Padel-kamp på PadelMakker',
    text: buildMatchShareText(match),
    url: shareMatchUrl(SITE_ORIGIN, match.id),
  });
}

/**
 * @param {{ tournament: object, hostName?: string, participantCount?: number }} options
 * @returns {Promise<ShareResult>}
 */
export async function shareAmericanoTournament({ tournament, hostName, participantCount }) {
  if (!tournament?.id) {
    return { ok: false, method: 'none', error: 'Turnering mangler' };
  }
  return shareViaWebOrClipboard({
    title: `${tournamentFormatLabel(tournament)} på PadelMakker`,
    text: buildTournamentShareText(tournament, { hostName, participantCount }),
    url: shareTournamentUrl(SITE_ORIGIN, tournament.id),
  });
}

export { shareResultToastMessage } from './shareFeedback';

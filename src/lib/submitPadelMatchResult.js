import { buildMatchResultInsertPayload } from './matchResultPayload.js';
import { validateMatchRosterForElo, validateSubmittedPadelResult } from './padelResultGuards.js';

function defaultTeamOf(player) {
  return Number(player?.team);
}

export async function submitPadelMatchResult({
  supabaseClient,
  createNotificationFn,
  matchId,
  players,
  submittedBy,
  submitterName,
  result,
  getTeam = defaultTeamOf,
}) {
  const roster = Array.isArray(players) ? players : [];
  const rosterCheck = validateMatchRosterForElo(roster, getTeam);
  if (!rosterCheck.ok) {
    return {
      ok: false,
      reason: rosterCheck.reason || 'Kampen har ikke en gyldig 2v2-holdopsætning.',
      code: 'invalid_roster',
    };
  }

  const resultCheck = validateSubmittedPadelResult(result);
  if (!resultCheck.ok) {
    return {
      ok: false,
      reason: resultCheck.reason || 'Resultatet er ikke gyldigt.',
      code: 'invalid_result',
    };
  }

  const payload = buildMatchResultInsertPayload({
    matchId,
    players: roster,
    submittedBy,
    result,
  });
  const scoreDisplay = payload.score_display;

  const { error } = await supabaseClient.from('match_results').insert(payload);
  if (error) throw error;

  await Promise.all(
    roster
      .filter((player) => String(player.user_id) !== String(submittedBy))
      .map((player) =>
        createNotificationFn(
          player.user_id,
          'result_submitted',
          'Resultat indsendt 📊',
          `${submitterName || 'En spiller'} har indsendt et resultat (${scoreDisplay}). Bekræft venligst.`,
          matchId,
        )
      ),
  );

  return { ok: true, scoreDisplay, payload };
}

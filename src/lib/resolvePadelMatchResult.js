import { formatMatchResultScore } from './matchResultScore.js';

function safePlayers(players) {
  return Array.isArray(players) ? players.filter((player) => player?.user_id) : [];
}

function playerTeamForUser(players, userId) {
  const player = safePlayers(players).find((row) => String(row.user_id) === String(userId));
  const team = Number(player?.team);
  return Number.isFinite(team) ? team : null;
}

export function canConfirmPadelMatchResult({
  result,
  players,
  confirmedBy,
  isAdmin = false,
}) {
  if (isAdmin) return { ok: true };
  if (!result?.submitted_by || !confirmedBy) {
    return { ok: false, reason: 'Resultatet skal bekræftes af en spiller fra modstanderholdet.' };
  }
  if (String(result.submitted_by) === String(confirmedBy)) {
    return { ok: false, reason: 'Resultatet skal bekræftes af en anden spiller fra modstanderholdet.' };
  }

  const submitterTeam = playerTeamForUser(players, result.submitted_by);
  const confirmerTeam = playerTeamForUser(players, confirmedBy);
  if (!confirmerTeam) {
    return { ok: false, reason: 'Resultatet skal bekræftes af en spiller fra modstanderholdet.' };
  }
  if (!submitterTeam) {
    return { ok: true };
  }
  if (submitterTeam === confirmerTeam) {
    return { ok: false, reason: 'Resultatet skal bekræftes af en spiller fra modstanderholdet.' };
  }

  return { ok: true };
}

export function filterConfirmablePendingResults({
  results,
  playersByMatchId,
  userId,
  isAdmin = false,
}) {
  const rows = Array.isArray(results) ? results : [];
  return rows.filter((result) => {
    if (!result?.match_id || !userId) return false;
    if (String(result.submitted_by) === String(userId)) return false;

    const players =
      playersByMatchId instanceof Map
        ? playersByMatchId.get(result.match_id)
        : playersByMatchId?.[result.match_id];

    return canConfirmPadelMatchResult({
      result,
      players,
      confirmedBy: userId,
      isAdmin,
    }).ok;
  });
}

export async function confirmPadelMatchResult({
  supabaseClient,
  calculateAndApplyEloFn,
  createNotificationFn,
  matchId,
  result,
  players,
  confirmedBy,
  isAdmin = false,
  showToast,
}) {
  if (!result?.id) {
    return { ok: false, reason: 'Resultat ikke fundet.' };
  }

  const confirmationAccess = canConfirmPadelMatchResult({
    result,
    players,
    confirmedBy,
    isAdmin,
  });
  if (!confirmationAccess.ok) return confirmationAccess;

  const { error } = await supabaseClient
    .from('match_results')
    .update({ confirmed: true, confirmed_by: confirmedBy })
    .eq('id', result.id);
  if (error) throw error;

  const eloResult = await calculateAndApplyEloFn(matchId, showToast, { matchResultId: result.id });
  if (!eloResult?.success) {
    return { ok: true, eloApplied: false, eloResult };
  }

  const playersUpdated = Number(eloResult.data?.players_updated) || 0;
  const scoreDisplay = formatMatchResultScore(result);
  const body =
    playersUpdated > 0
      ? `Kampen er afsluttet (${scoreDisplay}). Personlig ELO er opdateret.`
      : `Kampen er afsluttet (${scoreDisplay}), men ELO blev ikke ændret.`;

  await Promise.allSettled(
    safePlayers(players).map((player) =>
      createNotificationFn(
        player.user_id,
        'result_confirmed',
        'Resultat bekræftet!',
        body,
        matchId,
      )
    ),
  );

  return {
    ok: true,
    eloApplied: true,
    scoreDisplay,
    playersUpdated,
  };
}

export async function rejectPadelMatchResult({
  supabaseClient,
  createNotificationFn,
  matchId,
  result,
  rejectedBy,
  rejecterName,
  onWarn,
}) {
  if (!result?.id) {
    return { ok: false, reason: 'Resultat ikke fundet.' };
  }

  const { error: deleteError } = await supabaseClient
    .from('match_results')
    .delete()
    .eq('id', result.id);
  if (deleteError) throw deleteError;

  const submitterNotified = Boolean(result.submitted_by && String(result.submitted_by) !== String(rejectedBy));
  if (submitterNotified) {
    await createNotificationFn(
      result.submitted_by,
      'result_submitted',
      'Resultat afvist ❌',
      `${rejecterName || 'En spiller'} har afvist dit indberettede resultat. Indrapportér igen.`,
      matchId,
    );
  }

  let adminsNotified = 0;
  try {
    const { data: admins, error } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('id', rejectedBy);
    if (error) throw error;
    const adminRows = Array.isArray(admins) ? admins : [];
    adminsNotified = adminRows.length;
    await Promise.allSettled(
      adminRows.map((admin) =>
        createNotificationFn(
          admin.id,
          'result_submitted',
          'Resultat afvist ❌',
          `${rejecterName || 'En spiller'} har afvist et indberettet resultat. Kampen venter på et nyt resultat.`,
          matchId,
        )
      ),
    );
  } catch (error) {
    if (typeof onWarn === 'function') onWarn(error);
  }

  return { ok: true, adminsNotified, submitterNotified };
}

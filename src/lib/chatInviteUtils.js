import { supabase } from './supabase';
import { buildMatchInvitePayload } from './chatMessageUtils';
import { rpcJoinOpenMatch } from './matchJoinUtils';
import { listShareableCourts } from './chatVenueShareUtils';
import { createNotificationsForUsers, sendPushNotificationsForUsers } from './notifications';

export { mapBanerVenueToShareableCourt } from './chatVenueShareUtils';
export async function fetchInvitableMatches(userId) {
  if (!userId) return [];

  const { data: playerRows, error: playerErr } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('user_id', userId);

  if (playerErr) throw playerErr;

  const matchIds = [...new Set((playerRows || []).map((r) => r.match_id).filter(Boolean))];
  if (matchIds.length === 0) return [];

  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, creator_id, court_name, date, time, status, max_players, current_players, match_type')
    .in('id', matchIds)
    .in('status', ['open', 'full'])
    .order('date', { ascending: true });

  if (matchErr) throw matchErr;

  const today = new Date().toISOString().slice(0, 10);
  return (matches || []).filter((m) => !m.date || m.date >= today);
}

export async function fetchMatchPlayerCount(matchId) {
  const { count, error } = await supabase
    .from('match_players')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId);
  if (error) return 0;
  return count || 0;
}

export async function buildInvitePayloadForMatch(match) {
  const count = await fetchMatchPlayerCount(match.id);
  return buildMatchInvitePayload(match, count);
}

export async function joinMatchFromChatInvite({
  matchId,
  userId,
  userName,
  userEmail,
  userAvatar,
}) {
  const { data: matchRow, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, match_type, current_players, max_players, creator_id')
    .eq('id', matchId)
    .maybeSingle();
  if (matchErr) throw matchErr;
  if (!matchRow) throw new Error('Kampen findes ikke længere.');

  const matchType = matchRow.match_type || 'open';
  const status = (matchRow.status || 'open').toLowerCase();
  if (matchType === 'closed') {
    throw new Error('Denne kamp kræver godkendelse fra opretteren.');
  }
  if (!['open', 'full'].includes(status)) {
    throw new Error('Kampen accepterer ikke tilmeldinger lige nu.');
  }
  const maxPlayers = Number(matchRow.max_players) || 4;
  if (Number(matchRow.current_players) >= maxPlayers) {
    throw new Error('Kampen er allerede fuld.');
  }

  const result = await rpcJoinOpenMatch({
    matchId,
    team: null,
    userName,
    userEmail,
    userEmoji: userAvatar || '🎾',
  });

  const alreadyJoined = result?.already_joined === true;
  const teamNum = result?.team;
  const isFull = result?.is_full === true;

  if (!alreadyJoined) {
    const { error: nErr } = await supabase.rpc('notify_match_creator_on_join', {
      p_match_id: matchId,
      p_title: 'Ny spiller tilmeldt!',
      p_body: `${userName || 'En spiller'} har tilmeldt sig Hold ${teamNum} i din kamp.`,
    });
    if (nErr) console.warn('notify_match_creator_on_join (chat invite):', nErr.message || nErr);
    else if (matchRow.creator_id && userId && String(matchRow.creator_id) !== String(userId)) {
      void sendPushNotificationsForUsers(
        [matchRow.creator_id],
        'match_join',
        'Ny spiller tilmeldt!',
        `${userName || 'En spiller'} har tilmeldt sig Hold ${teamNum} i din kamp.`,
        matchId,
      );
    }
  }

  if (isFull && userId) {
    const { data: playerRows } = await supabase
      .from('match_players')
      .select('user_id')
      .eq('match_id', matchId);
    const fullNotifyIds = (playerRows || [])
      .filter((p) => p.user_id && String(p.user_id) !== String(userId))
      .map((p) => p.user_id);
    if (fullNotifyIds.length) {
      void createNotificationsForUsers(
        fullNotifyIds,
        'match_full',
        'Kampen er fuld! 🎾',
        'Alle 4 pladser er fyldt — kampen er klar til at starte.',
        matchId,
      );
    }
  }

  return {
    alreadyJoined,
    teamNum,
    isFull,
  };
}

export async function fetchShareableCourts(limit = 200) {
  return listShareableCourts(limit);
}

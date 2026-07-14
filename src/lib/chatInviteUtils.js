import { supabase } from './supabase';
import { buildMatchInvitePayload } from './chatMessageUtils';
import { rpcJoinOpenMatch } from './matchJoinUtils';

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
    .select('id, status, match_type, current_players, max_players')
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
    userAvatar,
  });

  return {
    alreadyJoined: result?.already_joined === true,
    teamNum: result?.team,
    isFull: result?.is_full === true,
  };
}

export async function fetchShareableCourts(limit = 80) {
  const { data, error } = await supabase
    .from('courts')
    .select('id, name, city, booking_url')
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data || [];
}

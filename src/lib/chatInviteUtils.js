import { supabase } from './supabase';
import { buildMatchInvitePayload } from './chatMessageUtils';

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
  const { data: existing } = await supabase
    .from('match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) return { alreadyJoined: true };

  const { data: players } = await supabase
    .from('match_players')
    .select('team')
    .eq('match_id', matchId);

  const team1 = (players || []).filter((p) => Number(p.team) === 1).length;
  const team2 = (players || []).filter((p) => Number(p.team) === 2).length;
  const teamNum = team1 <= team2 ? 1 : 2;

  const { error } = await supabase.from('match_players').insert({
    match_id: matchId,
    user_id: userId,
    user_name: userName || 'Spiller',
    user_email: userEmail || null,
    user_emoji: userAvatar || '🎾',
    team: teamNum,
  });

  if (error) throw error;

  const total = (players || []).length + 1;
  const t1 = teamNum === 1 ? team1 + 1 : team1;
  const t2 = teamNum === 2 ? team2 + 1 : team2;

  if (t1 >= 2 && t2 >= 2) {
    await supabase.from('matches').update({ status: 'full', current_players: 4, seeking_player: false }).eq('id', matchId);
  } else {
    await supabase.from('matches').update({ current_players: total }).eq('id', matchId);
  }

  return { alreadyJoined: false, teamNum };
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

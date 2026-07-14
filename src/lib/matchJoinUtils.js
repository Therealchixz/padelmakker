import { supabase } from './supabase.js';
import { mapJoinMatchError, mapLeaveMatchError } from './matchJoinErrorUtils.js';

export { mapJoinMatchError, mapLeaveMatchError } from './matchJoinErrorUtils.js';

export async function rpcJoinOpenMatch({
  matchId,
  team = null,
  userName,
  userEmail,
  userEmoji,
}) {
  const { data, error } = await supabase.rpc('join_open_match', {
    p_match_id: matchId,
    p_team: team,
    p_user_name: userName || null,
    p_user_email: userEmail || null,
    p_user_emoji: userEmoji || '🎾',
  });
  const msg = mapJoinMatchError(data, error);
  if (msg) throw new Error(msg);
  return data;
}

export async function rpcLeaveMatch(matchId) {
  const { data, error } = await supabase.rpc('leave_match', {
    p_match_id: matchId,
  });
  const msg = mapLeaveMatchError(data, error);
  if (msg) throw new Error(msg);
  return data;
}

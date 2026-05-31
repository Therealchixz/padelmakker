import { supabase } from './supabase';
import { messagePreview } from './chatMessageUtils';

const TEAM_MESSAGE_SELECT = 'id, team_id, league_id, sender_id, sender_name, sender_avatar, content, created_at, message_type, payload, reaction';

export async function fetchLeagueTeamMessages(teamId, limit = 80) {
  if (!teamId) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));

  const { data, error } = await supabase
    .from('league_team_messages')
    .select(TEAM_MESSAGE_SELECT)
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (error) throw error;
  return data || [];
}

export async function sendLeagueTeamMessage({
  teamId,
  leagueId,
  senderId,
  senderName,
  senderAvatar = null,
  content,
  messageType = 'text',
  payload = null,
}) {
  const trimmed = String(content || '').trim();
  const preview = trimmed || messagePreview({ message_type: messageType, payload, content: trimmed });
  if (!preview || !teamId) return null;

  const { data, error } = await supabase
    .from('league_team_messages')
    .insert({
      team_id: teamId,
      league_id: leagueId,
      sender_id: senderId,
      sender_name: senderName || 'Spiller',
      sender_avatar: senderAvatar || null,
      content: preview,
      message_type: messageType,
      payload,
    })
    .select(TEAM_MESSAGE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function setLeagueTeamMessageReaction(messageId, reaction) {
  const { data, error } = await supabase.rpc('set_league_team_message_reaction', {
    p_message_id: messageId,
    p_reaction: reaction || '',
  });
  if (error) throw error;
  return data;
}

export function subscribeToLeagueTeamMessages(teamId, onInsert, onUpdate) {
  if (!teamId) return () => {};

  const channel = supabase
    .channel(`liga-team-chat-${teamId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'league_team_messages',
        filter: `team_id=eq.${teamId}`,
      },
      (payload) => onInsert?.(payload?.new || null)
    );

  if (typeof onUpdate === 'function') {
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'league_team_messages',
        filter: `team_id=eq.${teamId}`,
      },
      (payload) => onUpdate?.(payload?.new || null)
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchLeagueTeamMeta(teamId) {
  if (!teamId) return null;
  const { data, error } = await supabase
    .from('league_teams')
    .select('id, name, league_id, leagues(name)')
    .eq('id', teamId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    teamId: data.id,
    teamName: data.name || 'Hold',
    leagueId: data.league_id,
    leagueName: data.leagues?.name || 'Liga',
  };
}

/** Samtaler med liga-hold (seneste besked per hold). */
export async function fetchLeagueTeamConversations(userId) {
  if (!userId) return [];

  const { data: myTeams, error: myErr } = await supabase
    .from('league_teams')
    .select('league_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

  if (myErr) throw myErr;

  const leagueIds = [...new Set((myTeams || []).map((t) => t.league_id).filter(Boolean))];
  if (leagueIds.length === 0) return [];

  const { data: teams, error: teamErr } = await supabase
    .from('league_teams')
    .select('id, name, league_id, leagues(name)')
    .in('league_id', leagueIds);

  if (teamErr) throw teamErr;

  const teamIds = (teams || []).map((t) => t.id).filter(Boolean);
  if (teamIds.length === 0) return [];

  const { data: msgs, error: msgErr } = await supabase
    .from('league_team_messages')
    .select('id, team_id, content, created_at, sender_id, sender_name, message_type, payload')
    .in('team_id', teamIds)
    .order('created_at', { ascending: false })
    .limit(400);

  if (msgErr) throw msgErr;

  const latestByTeam = {};
  for (const msg of msgs || []) {
    if (!latestByTeam[msg.team_id]) latestByTeam[msg.team_id] = msg;
  }

  return Object.entries(latestByTeam)
    .map(([teamId, lastMessage]) => {
      const team = (teams || []).find((t) => t.id === teamId);
      const isFromMe = String(lastMessage.sender_id) === String(userId);
      const previewText = messagePreview(lastMessage);
      return {
        type: 'league_team',
        teamId,
        teamName: team?.name || 'Hold',
        leagueId: team?.league_id,
        leagueName: team?.leagues?.name || '',
        lastMessage,
        preview: isFromMe ? `Dig: ${previewText}` : `${lastMessage.sender_name || 'Spiller'}: ${previewText}`,
        unread: 0,
      };
    })
    .sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
}

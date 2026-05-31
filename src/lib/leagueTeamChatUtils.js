import { supabase } from './supabase';

export function formatTeamChatClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export async function fetchLeagueTeamMessages(teamId, limit = 80) {
  if (!teamId) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));

  const { data, error } = await supabase
    .from('league_team_messages')
    .select('id, team_id, league_id, sender_id, sender_name, sender_avatar, content, created_at')
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
}) {
  const trimmed = String(content || '').trim();
  if (!trimmed || !teamId) return null;

  const { data, error } = await supabase
    .from('league_team_messages')
    .insert({
      team_id: teamId,
      league_id: leagueId,
      sender_id: senderId,
      sender_name: senderName || 'Spiller',
      sender_avatar: senderAvatar || null,
      content: trimmed,
    })
    .select('id, team_id, league_id, sender_id, sender_name, sender_avatar, content, created_at')
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToLeagueTeamMessages(teamId, onInsert) {
  if (!teamId || typeof onInsert !== 'function') return () => {};

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
      (payload) => onInsert(payload?.new || null)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { aggregateLigaRelationStats } from './ligaRelationStatsCore.js';

export { aggregateLigaRelationStats } from './ligaRelationStatsCore.js';

const EMPTY_STATS = {
  bestPartners: [],
  toughestPartners: [],
  hardestOpponents: [],
  easiestOpponents: [],
};

/**
 * Makker/modstander-statistik fra rapporterede ligakampe (hold vs hold).
 */
export function useLigaPartnerOpponentStats(userId, enabled = true) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !enabled) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: teamRows, error: teamErr } = await supabase
          .from('league_teams')
          .select(
            'id, league_id, player1_id, player2_id, player1_name, player2_name, player1_avatar, player2_avatar, status',
          )
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
        if (teamErr) throw teamErr;

        const teams = (teamRows || []).filter((t) => t.status === 'ready' || t.player1_id === userId);
        const teamIds = teams.map((t) => t.id).filter(Boolean);
        if (teamIds.length === 0) {
          if (!cancelled) setStats(EMPTY_STATS);
          return;
        }

        const leagueIds = [...new Set(teams.map((t) => t.league_id).filter(Boolean))];
        const { data: allTeams, error: allTeamsErr } = await supabase
          .from('league_teams')
          .select(
            'id, league_id, player1_id, player2_id, player1_name, player2_name, player1_avatar, player2_avatar, status',
          )
          .in('league_id', leagueIds);
        if (allTeamsErr) throw allTeamsErr;

        const teamsById = Object.fromEntries((allTeams || []).map((t) => [t.id, t]));

        const [m1, m2] = await Promise.all([
          supabase
            .from('league_matches')
            .select('id, team1_id, team2_id, winner_id, status')
            .eq('status', 'reported')
            .in('team1_id', teamIds),
          supabase
            .from('league_matches')
            .select('id, team1_id, team2_id, winner_id, status')
            .eq('status', 'reported')
            .in('team2_id', teamIds),
        ]);
        if (m1.error) throw m1.error;
        if (m2.error) throw m2.error;

        const uniqueMatches = new Map();
        for (const row of [...(m1.data || []), ...(m2.data || [])]) {
          uniqueMatches.set(row.id, row);
        }

        const aggregated = aggregateLigaRelationStats({
          matches: [...uniqueMatches.values()],
          teamsById,
          userId,
        });

        const otherUserIds = [
          ...new Set(
            [
              ...aggregated.bestPartners,
              ...aggregated.toughestPartners,
              ...aggregated.hardestOpponents,
              ...aggregated.easiestOpponents,
            ].map((p) => p.userId),
          ),
        ];

        if (otherUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, avatar, full_name, name')
            .in('id', otherUserIds);
          const avatarById = Object.fromEntries(
            (profiles || []).map((pr) => [String(pr.id), pr.avatar || '👤']),
          );
          const nameById = Object.fromEntries(
            (profiles || []).map((pr) => [
              String(pr.id),
              pr.full_name || pr.name || null,
            ]),
          );
          const enrich = (list) =>
            list.map((p) => ({
              ...p,
              emoji: avatarById[String(p.userId)] || p.emoji,
              name: nameById[String(p.userId)] || p.name,
            }));
          aggregated.bestPartners = enrich(aggregated.bestPartners);
          aggregated.toughestPartners = enrich(aggregated.toughestPartners);
          aggregated.hardestOpponents = enrich(aggregated.hardestOpponents);
          aggregated.easiestOpponents = enrich(aggregated.easiestOpponents);
        }

        if (!cancelled) setStats(aggregated);
      } catch (e) {
        console.warn('liga relation stats:', e?.message || e);
        if (!cancelled) setStats(EMPTY_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return { ligaRelationStats: stats, ligaRelationLoading: loading };
}

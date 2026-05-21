import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { aggregateAmericanoRelationStats } from './americanoRelationStatsCore.js';

export { aggregateAmericanoRelationStats, outcomeForUserInAmericanoRound } from './americanoRelationStatsCore.js';

const EMPTY_STATS = {
  bestPartners: [],
  toughestPartners: [],
  hardestOpponents: [],
  easiestOpponents: [],
};

/**
 * Makker/modstander-statistik fra afsluttede Americano-turneringer (per runde på banen).
 */
export function useAmericanoPartnerOpponentStats(userId, enabled = true) {
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
        const { data: myParticipants, error: partErr } = await supabase
          .from('americano_participants')
          .select('id, tournament_id')
          .eq('user_id', userId);
        if (partErr) throw partErr;

        const tournamentIds = [
          ...new Set((myParticipants || []).map((p) => p.tournament_id).filter(Boolean)),
        ];
        if (tournamentIds.length === 0) {
          if (!cancelled) setStats(EMPTY_STATS);
          return;
        }

        const { data: tournaments, error: tErr } = await supabase
          .from('americano_tournaments')
          .select('id, points_per_match, status')
          .in('id', tournamentIds)
          .eq('status', 'completed');
        if (tErr) throw tErr;

        const completedIds = (tournaments || []).map((t) => t.id);
        if (completedIds.length === 0) {
          if (!cancelled) setStats(EMPTY_STATS);
          return;
        }

        const pointsPerMatchByTournamentId = Object.fromEntries(
          (tournaments || []).map((t) => [t.id, t.points_per_match]),
        );

        const { data: matches, error: mErr } = await supabase
          .from('americano_matches')
          .select(
            'tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score',
          )
          .in('tournament_id', completedIds)
          .not('team_a_score', 'is', null)
          .not('team_b_score', 'is', null);
        if (mErr) throw mErr;

        const { data: participants, error: allPartErr } = await supabase
          .from('americano_participants')
          .select('id, tournament_id, user_id, display_name')
          .in('tournament_id', completedIds);
        if (allPartErr) throw allPartErr;

        const aggregated = aggregateAmericanoRelationStats({
          matches: matches || [],
          participants: participants || [],
          pointsPerMatchByTournamentId,
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
        console.warn('americano relation stats:', e?.message || e);
        if (!cancelled) setStats(EMPTY_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return { americanoRelationStats: stats, americanoRelationLoading: loading };
}

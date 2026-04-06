// src/features/matches/useMatches.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

export function useMatches() {
  const { user, profile } = useAuth();
  const [matches, setMatches] = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const myDisplayName = profile?.full_name || profile?.name || "Spiller";

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [courtData, matchData] = await Promise.all([
        supabase.from('courts').select('*'),
        supabase.from('matches').select('*')
      ]);

      setCourts(courtData.data || []);

      const allMatches = matchData.data || [];
      setMatches(allMatches);

      // Hent match players
      const { data: mpData } = await supabase.from('match_players').select('*');
      const mpMap = {};
      (mpData || []).forEach(mp => {
        if (!mpMap[mp.match_id]) mpMap[mp.match_id] = [];
        mpMap[mp.match_id].push(mp);
      });
      setMatchPlayers(mpMap);

      // Hent match results
      const { data: mrData } = await supabase.from('match_results').select('*');
      const mrMap = {};
      (mrData || []).forEach(mr => { mrMap[mr.match_id] = mr; });
      setMatchResults(mrMap);

    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new match
  const createMatch = async (newMatchData) => {
    if (!user) return;
    setBusyId('create');
    try {
      const court = courts.find(c => c.id === newMatchData.court_id);
      const { data, error } = await supabase.from('matches').insert({
        creator_id: user.id,
        court_id: newMatchData.court_id,
        court_name: court?.name || '',
        date: newMatchData.date,
        time: newMatchData.time,
        time_end: newMatchData.time_end,
        description: newMatchData.description || null,
        status: 'open',
        max_players: 4,
        current_players: 1,
      }).select().single();

      if (error) throw error;

      // Tilføj skaberen til hold 1
      await supabase.from('match_players').insert({
        match_id: data.id,
        user_id: user.id,
        user_name: myDisplayName,
        user_emoji: profile?.avatar || '🎾',
        team: 1,
      });

      await loadData();
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setBusyId(null);
    }
  };

  // Join match with team
  const joinMatch = async (matchId, teamNum) => {
    setBusyId(matchId);
    try {
      await supabase.from('match_players').insert({
        match_id: matchId,
        user_id: user.id,
        user_name: myDisplayName,
        user_emoji: profile?.avatar || '🎾',
        team: teamNum,
      });

      await loadData();
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setBusyId(null);
    }
  };

  const leaveMatch = async (matchId) => {
    setBusyId(matchId);
    try {
      await supabase.from('match_players').delete()
        .eq('match_id', matchId)
        .eq('user_id', user.id);
      await loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyId(null);
    }
  };

  const startMatch = async (matchId) => {
    setBusyId(matchId);
    try {
      await supabase.from('matches').update({
        status: 'in_progress',
        started_by: user.id,
        started_at: new Date().toISOString(),
      }).eq('id', matchId);
      await loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyId(null);
    }
  };

  return {
    matches,
    matchPlayers,
    matchResults,
    courts,
    loading,
    busyId,
    loadData,
    createMatch,
    joinMatch,
    leaveMatch,
    startMatch,
    myDisplayName,
  };
}

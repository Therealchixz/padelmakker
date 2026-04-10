import { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile } from '../api/base44Client';
import { supabase } from '../lib/supabase';
import { font, theme, btn, heading } from '../lib/platformTheme';
import {
  statsFromEloHistoryRows,
  useProfileEloBundle,
  allTimeStatsMapFromEloHistory,
  formatLocalDateYMD,
  eloHistoryRowDateKey,
} from '../lib/eloHistoryUtils';
import { PlayerProfileModal } from './PlayerProfileModal';

export function RankingTab({ user }) {
  const [players, setPlayers] = useState([]);
  const [eloHistory, setEloHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPlayer, setViewPlayer] = useState(null);
  const [period, setPeriod] = useState(() => {
    try { return localStorage.getItem("pm-rank-period") || "all"; } catch { return "all"; }
  });

  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading: myBundleLoading, profileFresh: myProfileFresh, ratedRows: myRatedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const myHistStats = useMemo(() => statsFromEloHistoryRows(myRatedRows), [myRatedRows]);
  const myAllTimeElo = myHistStats?.elo ?? Math.round(Number(myProfileFresh?.elo_rating ?? user.elo_rating) || 1000);
  const myAllTimeGames = myHistStats?.games ?? (myProfileFresh?.games_played ?? user.games_played ?? 0);
  const myAllTimeWins = myHistStats?.wins ?? (myProfileFresh?.games_won ?? user.games_won ?? 0);

  const allTimeFromHistory = useMemo(() => allTimeStatsMapFromEloHistory(eloHistory), [eloHistory]);
  const myId = user?.id != null ? String(user.id) : "";

  useEffect(() => {
    try {
      localStorage.setItem("pm-rank-period", period);
    } catch {
      /* private mode / storage disabled */
    }
  }, [period]);

  const loadRankingData = useCallback(async () => {
    try {
      const [profileData, historyData] = await Promise.all([
        Profile.filter(),
        supabase
          .from("elo_history")
          .select("*")
          .order("date", { ascending: false })
          .order("match_id", { ascending: false })
          .limit(10000),
      ]);
      setPlayers(profileData || []);
      setEloHistory(historyData.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRankingData();
  }, [loadRankingData, eloSyncKey]);

  useEffect(() => {
    let lastVisFetch = 0;
    const throttleMs = 120000;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisFetch < throttleMs) return;
      lastVisFetch = now;
      loadRankingData();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadRankingData]);

  // Calculate period start dates
  const now = new Date();
  const getMonday = () => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const getMonthStart = () => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Build ranking based on period
  const buildRanking = () => {
    if (period === "all") {
      return [...players]
        .map(p => {
          const pid = String(p.id);
          const h = allTimeFromHistory[pid];
          const isMe = myId && pid === myId;
          const isMeReady = isMe && !myBundleLoading;
          return {
            ...p,
            score: isMeReady ? myAllTimeElo : (h?.elo ?? Math.round(Number(p.elo_rating) || 1000)),
            periodGames: isMeReady ? myAllTimeGames : (h?.games ?? (p.games_played || 0)),
            periodWins: isMeReady ? myAllTimeWins : (h?.wins ?? (p.games_won || 0)),
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    const cutoff = period === "week" ? getMonday() : getMonthStart();
    const cutoffStr = formatLocalDateYMD(cutoff);

    // Sum ELO changes per player within the period (lokal dato vs. cutoff — undgår UTC-forskydning)
    const periodStats = {};
    eloHistory.forEach(h => {
      if (h.old_rating == null || h.match_id == null) return;
      const rowDay = eloHistoryRowDateKey(h);
      if (rowDay == null || rowDay < cutoffStr) return;
      const uid = String(h.user_id);
      if (!periodStats[uid]) periodStats[uid] = { change: 0, games: 0, wins: 0 };
      periodStats[uid].change += Number(h.change) || 0;
      periodStats[uid].games += 1;
      if (h.result === "win") periodStats[uid].wins += 1;
    });

    return [...players]
      .map(p => {
        const stats = periodStats[String(p.id)] || { change: 0, games: 0, wins: 0 };
        return { ...p, score: stats.change, periodGames: stats.games, periodWins: stats.wins };
      })
      .filter(p => p.periodGames > 0)
      .sort((a, b) => b.score - a.score);
  };

  const sorted = useMemo(
    () => buildRanking(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, players, eloHistory, allTimeFromHistory, myId, myBundleLoading, myAllTimeElo, myAllTimeGames, myAllTimeWins]
  );
  const userRank = sorted.findIndex(p => String(p.id) === myId) + 1;
  const userEntry = sorted.find(p => String(p.id) === myId);
  const displayScore = period === "all"
    ? (myBundleLoading ? null : (myAllTimeElo ?? allTimeFromHistory[myId]?.elo ?? Math.round(Number(user.elo_rating) || 1000)))
    : (userEntry?.score || 0);
  const medals = ["🥇", "🥈", "🥉"];

  const periodLabels = {
    week: "Denne uge",
    month: "Denne måned",
    all: "All-time",
  };

  const periodInfo = {
    week: "Nulstilles hver mandag",
    month: "Nulstilles d. 1 i måneden",
    all: "Samlet ELO-rating",
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser ranking...</div>;

  return (
    <div>
      <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "16px" }}>Ranking</h2>

      {/* Period tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {["week", "month", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ ...btn(period === p), padding: "8px 14px", fontSize: "12px", flex: 1, justifyContent: "center" }}>
            {p === "week" ? "📅 Uge" : p === "month" ? "🗓️ Måned" : "🏆 All-time"}
          </button>
        ))}
      </div>

      {/* Period info */}
      <div style={{ fontSize: "12px", color: theme.textLight, marginBottom: "16px", textAlign: "center" }}>
        {periodLabels[period]} · {periodInfo[period]}
      </div>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff" }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "6px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din placering · {periodLabels[period]}</div>
        <div className="pm-rank-hero-inner">
          <div>
            <span style={{ fontFamily: font, fontSize: "clamp(32px,8vw,40px)", fontWeight: 800, letterSpacing: "-0.04em" }}>
              {period === "all" && myBundleLoading ? "…" : userRank > 0 ? `#${userRank}` : "—"}
            </span>
            <span style={{ fontSize: "14px", marginLeft: "8px", opacity: 0.6 }}>
              {period === "all" && myBundleLoading ? "" : sorted.length > 0 ? `af ${sorted.length}` : ""}
            </span>
          </div>
          <div className="pm-rank-hero-elo">
            <div style={{ fontFamily: font, fontSize: "clamp(20px,5vw,24px)", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {period === "all" && displayScore === null ? "…" : period === "all" ? displayScore : (displayScore > 0 ? "+" + displayScore : displayScore)}
            </div>
            <div style={{ fontSize: "10px", opacity: 0.65, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {period === "all" ? "ELO" : "ELO ændring"}
            </div>
          </div>
        </div>
        {period === "all" && displayScore != null && (
          <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", height: "6px" }}>
            <div style={{ width: Math.min((displayScore / 2000) * 100, 100) + "%", height: "100%", background: theme.warm, borderRadius: "6px" }} />
          </div>
        )}
        {userEntry && (period !== "all" || !myBundleLoading) && (
          <div style={{ marginTop: "12px", fontSize: "12px", opacity: 0.7 }}>
            {userEntry.periodGames} kampe · {userEntry.periodWins} sejre
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>
            {period === "week" ? "Ingen kampe denne uge endnu" : period === "month" ? "Ingen kampe denne måned endnu" : "Ingen spillere fundet"}
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.5 }}>Spil en kamp for at komme på ranglisten!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {sorted.map((p, i) => {
            const me = p.id === user.id;
            const score = p.score;
            const isPositive = period !== "all" && score > 0;
            const isNegative = period !== "all" && score < 0;
            return (
              <div key={p.id} onClick={() => !me && setViewPlayer(p)} className="pm-rank-row" style={{ background: me ? theme.accentBg : theme.surface, borderRadius: "8px", padding: "12px 14px", boxShadow: me ? "none" : theme.shadow, display: "flex", alignItems: "center", gap: "12px", border: me ? "1.5px solid " + theme.accent + "35" : "1px solid " + theme.border, cursor: me ? "default" : "pointer" }}>
                <div style={{ width: "28px", flexShrink: 0, textAlign: "center", fontSize: i < 3 ? "18px" : "13px", fontWeight: 700, color: i < 3 ? "inherit" : theme.textLight }}>
                  {i < 3 ? medals[i] : i + 1}
                </div>
                <div style={{ width: "38px", height: "38px", flexShrink: 0, borderRadius: "50%", background: "#F1F5F9", border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
                  {p.avatar || "🎾"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: me ? 700 : 600, letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                    {p.full_name || p.name}{me ? " (dig)" : ""}
                  </div>
                  <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "1px" }}>
                    {period === "all"
                      ? `${p.area || "?"} · ${p.periodGames} kampe · ${p.periodWins} sejre`
                      : `${p.periodGames} kampe · ${p.periodWins} sejre`
                    }
                  </div>
                </div>
                <div className="pm-rank-score" style={{ fontFamily: font, fontSize: "17px", fontWeight: 800, flexShrink: 0, letterSpacing: "-0.02em", color: period === "all" ? theme.accent : isPositive ? theme.accent : isNegative ? theme.red : theme.textLight }}>
                  {period === "all" ? score : (score > 0 ? "+" + score : score)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}

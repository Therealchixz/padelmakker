import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { theme, btn, tag } from '../lib/platformTheme';
import { availabilityTags } from '../lib/platformUtils';
import { filterRatedEloHistoryRows, statsFromEloHistoryRows, winStreaksFromEloHistory } from '../lib/eloHistoryUtils';
import { eloOf } from '../lib/matchDisplayUtils';
import { MapPin } from 'lucide-react';
import { calcAge } from '../lib/profileUtils';
import { AvatarCircle } from '../components/AvatarCircle';

export function PlayerProfileModal({ player, onClose }) {
  const [dataLoading, setDataLoading] = useState(true);
  const [streakError, setStreakError] = useState(false);
  const [streakStats, setStreakStats] = useState({ currentStreak: 0, bestStreak: 0 });
  const [ratedHistoryRows, setRatedHistoryRows] = useState([]);
  const [profileRow, setProfileRow] = useState(null);

  useEffect(() => {
    if (!player?.id) {
      setDataLoading(false);
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setProfileRow(null);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    setStreakError(false);
    setRatedHistoryRows([]);
    setProfileRow(null);
    (async () => {
      try {
        const [pr, hist] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", player.id).maybeSingle(),
          supabase.from("elo_history").select("*").eq("user_id", player.id).order("date", { ascending: true }),
        ]);
        if (cancelled) return;
        if (hist.error) throw hist.error;
        const rows = filterRatedEloHistoryRows(hist.data || []);
        setStreakStats(winStreaksFromEloHistory(rows));
        setRatedHistoryRows(rows);
        setProfileRow(pr.data || player);
      } catch {
        if (!cancelled) {
          setStreakError(true);
          setStreakStats({ currentStreak: 0, bestStreak: 0 });
          setRatedHistoryRows([]);
          setProfileRow(player);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [player]);

  if (!player) return null;
  const pRef = profileRow || player;
  const histStatsModal = statsFromEloHistoryRows(ratedHistoryRows);
  const elo = dataLoading ? null : (histStatsModal?.elo ?? eloOf(pRef));
  const games = dataLoading ? null : (histStatsModal?.games ?? (pRef.games_played || 0));
  const wins = dataLoading ? null : (histStatsModal?.wins ?? (pRef.games_won || 0));
  const winPct = games != null && games > 0 ? Math.round((wins / games) * 100) : 0;
  const age = calcAge(player.birth_year, player.birth_month, player.birth_day);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "14px", padding: "clamp(18px,5vw,28px)", maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Header */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
          <AvatarCircle
            avatar={player.avatar}
            size={64}
            emojiSize="32px"
            style={{ background: theme.accentBg, border: "2px solid " + theme.accent + "40" }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", wordBreak: "break-word" }}>{player.full_name || player.name || "Spiller"}</div>
            <div style={{ display: "flex", gap: "5px", marginTop: "6px", flexWrap: "wrap" }}>
              {!dataLoading && elo != null && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
              {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
              <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {player.area || "?"}</span>
            </div>
          </div>
        </div>

        {/* Stats — først når elo_history er hentet (undgå forældede tal fra liste) */}
        {dataLoading ? (
          <div style={{ textAlign: "center", padding: "16px", color: theme.textMid, fontSize: "13px", marginBottom: "16px" }}>Indlæser statistik…</div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {[
            { label: "ELO", value: elo, color: theme.accent },
            { label: "Kampe", value: games, color: theme.blue },
            { label: "Sejre", value: wins, color: theme.warm },
            { label: "Win %", value: games != null && games > 0 ? winPct + "%" : "—", color: theme.accent },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "10px 4px", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
        )}

        {/* Sejrsstreak (samme logik som egen profil — data fra elo_history) */}
        <div style={{ marginBottom: "16px", padding: "12px 14px", background: "#FFFBEB", borderRadius: "10px", border: "1px solid rgba(217, 119, 6, 0.2)" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sejrsstreak</div>
          {dataLoading ? (
            <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "8px" }}>Indlæser…</div>
          ) : streakError ? (
            <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "6px", lineHeight: 1.4 }}>Kunne ikke hente kamphistorik.</div>
          ) : (
            <>
              <div style={{ fontSize: "22px", fontWeight: 800, color: theme.warm, marginTop: "4px", letterSpacing: "-0.02em" }}>
                {streakStats.currentStreak > 0 ? `🔥 ${streakStats.currentStreak}` : "0"}
              </div>
              <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste: {streakStats.bestStreak} i træk</div>
            </>
          )}
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: theme.textLight }}>Spillestil</span>
            <span style={{ fontWeight: 600 }}>{player.play_style || "Ikke angivet"}</span>
          </div>
          {player.court_side && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: theme.textLight }}>Side på banen</span>
              <span style={{ fontWeight: 600 }}>{player.court_side}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: theme.textLight }}>Region</span>
            <span style={{ fontWeight: 600 }}>{player.area || "Ikke angivet"}</span>
          </div>
          {age && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: theme.textLight }}>Alder</span>
              <span style={{ fontWeight: 600 }}>{age} år</span>
            </div>
          )}
          {availabilityTags(player).length > 0 && (
            <div style={{ fontSize: "13px" }}>
              <span style={{ color: theme.textLight }}>Tilgængelighed</span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                {availabilityTags(player).map((a) => <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>)}
              </div>
            </div>
          )}
        </div>

        {player.bio && (
          <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", padding: "12px", background: "#F8FAFC", borderRadius: "8px", fontStyle: "italic" }}>
            &ldquo;{player.bio}&rdquo;
          </p>
        )}

        <button onClick={onClose} style={{ ...btn(false), width: "100%", justifyContent: "center" }}>Luk</button>
      </div>
    </div>
  );
}

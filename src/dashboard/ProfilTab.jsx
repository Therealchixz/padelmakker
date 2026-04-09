import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText, availabilityTags } from '../lib/platformUtils';
import { REGIONS, AVAILABILITY, PLAY_STYLES } from '../lib/platformConstants';
import { normalizeStringArrayField, validateFirstLastName, canonicalRegionForForm } from '../lib/profileUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, winStreaksFromEloHistory } from '../lib/eloHistoryUtils';
import { americanoOutcomeColors } from '../features/americano/americanoOutcomeColors';
import { EloGraph } from '../components/EloGraph';
import { MapPin, Settings, Swords, Trophy, TrendingUp, Save, X } from 'lucide-react';
import { profileFormState } from './profileTabHelpers';

export function ProfilTab({ user, showToast, setTab }) {
  const { updateProfile, user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const pStats = profileFresh || user;
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(pStats.elo_rating) || 1000);
  const games = histStats?.games ?? (pStats.games_played || 0);
  const wins = histStats?.wins ?? (pStats.games_won || 0);
  const eloHistory = ratedRows;
  const statsLoading = bundleLoading;
  const [form, setForm] = useState(() => profileFormState(user));

  useEffect(() => {
    if (!editing) setForm(profileFormState(user));
  }, [user, editing]);

  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => {
    const cur = normalizeStringArrayField(f.availability);
    return { ...f, availability: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] };
  });

  const handleSave = async () => {
    const nameCheck = validateFirstLastName(form.first_name, form.last_name);
    if (!nameCheck.valid) {
      showToast(nameCheck.message);
      return;
    }
    const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
    const region = canonicalRegionForForm(form.area) || form.area;
    const availability = normalizeStringArrayField(form.availability);
    setSaving(true);
    try {
      await updateProfile({
        full_name: sanitizeText(displayName),
        name: sanitizeText(displayName),
        area: region,
        play_style: form.play_style,
        bio: sanitizeText(form.bio.trim()),
        avatar: form.avatar,
        availability,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : null,
      });
      setEditing(false);
      showToast("Profil opdateret! ✅");
    } catch (e) {
      console.error(e);
      showToast("Kunne ikke gemme. Prøv igen.");
    } finally { setSaving(false); }
  };

  const winPct = games > 0 ? Math.round((wins / games) * 100) : 0;

  return (
    <div>
      {!editing ? (
      <div>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "20px" }}>Min profil</h2>

        {/* Profile card */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: theme.accentBg, border: "2px solid " + theme.accent + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 }}>
              {user.avatar || "🎾"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>{displayName}</div>
              <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>{authUser?.email}</div>
              <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
                {!statsLoading && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
                {user.birth_year && <span style={tag(theme.blueBg, theme.blue)}>{new Date().getFullYear() - user.birth_year} år</span>}
                <span style={tag(theme.blueBg, theme.blue)}>{user.play_style || "?"}</span>
                <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {user.area || "?"}</span>
              </div>
            </div>
          </div>

          {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", fontStyle: "italic" }}>&ldquo;{user.bio}&rdquo;</p>}

          {/* Stats — først når frisk profil + historik er hentet (ingen flash) */}
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px", marginBottom: "20px" }}>Indlæser statistik…</div>
          ) : (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "ELO", value: elo, color: theme.accent },
              { label: "Kampe", value: games, color: theme.blue },
              { label: "Sejre", value: wins, color: theme.warm },
              { label: "Win %", value: games > 0 ? winPct + "%" : "—", color: theme.accent },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 4px", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "20px" }}>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.win.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.win.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.win.text }}>{Number(user.americano_wins) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano sejre</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.tie.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.tie.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.tie.text }}>{Number(user.americano_draws) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano uafgjort</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.loss.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.loss.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.loss.text }}>{Number(user.americano_losses) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano tab</div>
            </div>
          </div>
          </>
          )}

          {/* Availability */}
          {availabilityTags(user).length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tilgængelighed</div>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {availabilityTags(user).map((a) => <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>)}
              </div>
            </div>
          )}

          <button onClick={() => { setForm(profileFormState(user)); setEditing(true); }} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
            <Settings size={14} /> Rediger profil
          </button>
        </div>

        {/* ELO over tid */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp size={16} color={theme.accent} /> ELO over tid
          </div>
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px" }}>Indlæser...</div>
          ) : (
            <EloGraph data={eloHistory} />
          )}
        </div>

        {/* Ekstra statistik */}
        {!statsLoading && (() => {
          const { currentStreak, bestStreak } = winStreaksFromEloHistory(eloHistory);

          const monthStats = {};
          eloHistory.forEach(h => {
            const key = h.date?.slice(0, 7);
            if (!key) return;
            if (!monthStats[key]) monthStats[key] = { wins: 0, games: 0, change: 0 };
            monthStats[key].games++;
            if (h.result === "win") monthStats[key].wins++;
            monthStats[key].change += (h.change || 0);
          });
          const months = Object.entries(monthStats);
          const bestMonth = months.length > 0
            ? months.reduce((best, [k, v]) => v.change > (best.change || -Infinity) ? { month: k, ...v } : best, { change: -Infinity })
            : null;
          const monthNames = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
          const fmtMonth = (m) => { const [y, mo] = m.split("-"); return monthNames[parseInt(mo, 10) - 1] + " " + y; };

          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Sejrsstreak</div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: theme.warm, letterSpacing: "-0.03em" }}>{currentStreak > 0 ? `🔥 ${currentStreak}` : "0"}</div>
                <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste: {bestStreak} i træk</div>
              </div>
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Bedste måned</div>
                {bestMonth && bestMonth.month ? (
                  <>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.02em", textTransform: "capitalize" }}>{fmtMonth(bestMonth.month)}</div>
                    <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>
                      {bestMonth.wins}/{bestMonth.games} sejre · {bestMonth.change > 0 ? "+" : ""}{bestMonth.change} ELO
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: "14px", color: theme.textMid }}>Ingen data endnu</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button onClick={() => setTab("kampe")} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Swords size={18} color={theme.accent} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine kampe</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>{games} spillet</div>
          </button>
          <button onClick={() => setTab("ranking")} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Trophy size={18} color={theme.warm} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Ranking</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>ELO {elo}</div>
          </button>
        </div>
      </div>
      ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)") }}>Rediger profil</h2>
        <button onClick={() => { setForm(profileFormState(user)); setEditing(false); }} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}>
          <X size={14} /> Annullér
        </button>
      </div>

      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
        {/* Avatar */}
        <label style={labelStyle}>Avatar</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {avatars.map(a => (
            <button key={a} onClick={() => set("avatar", a)} style={{ width: "48px", height: "48px", borderRadius: "50%", fontSize: "22px", border: form.avatar === a ? "2px solid " + theme.accent : "1px solid " + theme.border, background: form.avatar === a ? theme.accentBg : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>
          ))}
        </div>

        {/* Name */}
        <label style={labelStyle}>Fornavn</label>
        <input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" style={{ ...inputStyle, marginBottom: "10px" }} />
        <label style={labelStyle}>Efternavn</label>
        <input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" style={{ ...inputStyle, marginBottom: "6px" }} />
        <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "14px" }}>
          Mellemnavne med mellemrum er ok i hvert felt. Bindestreg også (Anne-Marie). Samme regler som ved oprettelse.
        </p>

        {/* Birth year */}
        <label style={labelStyle}>Fødselsår</label>
        <input value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="F.eks. 1995" type="text" inputMode="numeric" style={{ ...inputStyle, marginBottom: "14px" }} />

        {/* Area */}
        <label style={labelStyle}>Region</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {REGIONS.map((r) => (
            <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "6px 12px", fontSize: "12px" }}>{r}</button>
          ))}
        </div>

        {/* Play style */}
        <label style={labelStyle}>Spillestil</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {PLAY_STYLES.map(s => (
            <button key={s} onClick={() => set("play_style", s)} style={{ ...btn(form.play_style === s), padding: "6px 12px", fontSize: "12px" }}>{s}</button>
          ))}
        </div>

        {/* Availability */}
        <label style={labelStyle}>Hvornår kan du spille?</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {AVAILABILITY.map(a => (
            <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "6px 12px", fontSize: "12px" }}>{a}</button>
          ))}
        </div>

        {/* Bio */}
        <label style={labelStyle}>Bio</label>
        <textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl lidt om dig som spiller..." style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "20px" }} />

        <button onClick={handleSave} disabled={saving} style={{ ...btn(true), width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Gemmer..." : <><Save size={14} /> Gem ændringer</>}
        </button>
      </div>
    </div>
      )}
    </div>
  );
}

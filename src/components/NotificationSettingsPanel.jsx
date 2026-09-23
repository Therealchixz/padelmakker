import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme } from '../lib/platformTheme';
import { invalidateNotificationPrefsCache } from '../lib/notifications';
import {
  mergeNotificationPrefToggle,
  mergeNotificationEmailToggle,
  mergeNotificationPushLevel,
  mergeQuietHours,
  normalizeNotificationPrefs,
  NOTIFICATION_PUSH_CHANNELS,
  NOTIFICATION_EMAIL_CHANNELS,
  NOTIFICATION_PUSH_LEVELS,
} from '../lib/notificationPreferences';

const QUIET_HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Indstillinger for beskeder: niveau på telefonen, stille om natten, kanaler
 * og mail. Bruges både i klokke-menuen (computer) og på siden
 * /dashboard/notifikationer (telefon), så de kan ændres begge steder.
 */
export function NotificationSettingsPanel() {
  const { user: authUser, profile, updateProfile } = useAuth();
  const userId = authUser?.id;
  const [notifPrefs, setNotifPrefs] = useState(() => normalizeNotificationPrefs(profile?.notification_prefs));
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [showPrefToggles, setShowPrefToggles] = useState(false);

  useEffect(() => {
    setNotifPrefs(normalizeNotificationPrefs(profile?.notification_prefs));
  }, [profile?.notification_prefs]);

  const persistPrefs = async (nextPrefs) => {
    if (!userId) return;
    const prevPrefs = notifPrefs;
    setNotifPrefs(nextPrefs);
    setPrefsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: nextPrefs })
        .eq('id', userId);
      if (error) {
        console.warn('notification_prefs update:', error.message);
        setNotifPrefs(prevPrefs);
      } else {
        invalidateNotificationPrefsCache(userId);
        try {
          await updateProfile({ notification_prefs: nextPrefs });
        } catch (profileErr) {
          console.warn('notification_prefs profile sync:', profileErr?.message || profileErr);
        }
      }
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid " + theme.border, background: theme.surface }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textMid, marginBottom: "8px" }}>
          Notifikationer på telefon {prefsSaving ? "…" : ""}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {NOTIFICATION_PUSH_LEVELS.map((lvl) => {
            const active = (notifPrefs.pushLevel || "all") === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => { if (!active) void persistPrefs(mergeNotificationPushLevel(notifPrefs, lvl.id)); }}
                style={{
                  flex: 1,
                  padding: "7px 6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: "1px solid " + (active ? theme.accent : theme.border),
                  background: active ? theme.accent : theme.surface,
                  color: active ? theme.onAccent : theme.textMid,
                  cursor: active ? "default" : "pointer",
                  fontFamily: font,
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {lvl.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.4 }}>
          {notifPrefs.pushLevel === "off"
            ? "Ingen push til telefonen. Du ser stadig alt her i klokken."
            : notifPrefs.pushLevel === "important"
              ? "Kun invitationer, aflysninger, resultater og påmindelser sendes til telefonen."
              : "Alt sendes til telefonen (styret af kanalerne nedenfor)."}
        </div>
        {notifPrefs.pushLevel !== "off" && (
          <div style={{ marginTop: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: theme.text, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifPrefs.quietHours?.enabled !== false}
                onChange={(e) => { void persistPrefs(mergeQuietHours(notifPrefs, { enabled: e.target.checked })); }}
              />
              Stille om natten
            </label>
            {notifPrefs.quietHours?.enabled !== false && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: "12px", color: theme.textMid }}>
                <span>Fra kl.</span>
                <select
                  aria-label="Stille fra kl."
                  value={notifPrefs.quietHours?.start ?? 22}
                  onChange={(e) => { void persistPrefs(mergeQuietHours(notifPrefs, { start: Number(e.target.value) })); }}
                  style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "1px solid " + theme.border, background: theme.surface, color: theme.text, fontFamily: font }}
                >
                  {QUIET_HOUR_OPTIONS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
                <span>til kl.</span>
                <select
                  aria-label="Stille til kl."
                  value={notifPrefs.quietHours?.end ?? 7}
                  onChange={(e) => { void persistPrefs(mergeQuietHours(notifPrefs, { end: Number(e.target.value) })); }}
                  style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "1px solid " + theme.border, background: theme.surface, color: theme.text, fontFamily: font }}
                >
                  {QUIET_HOUR_OPTIONS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            )}
            <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "4px", lineHeight: 1.4 }}>
              Vigtige beskeder som aflysninger og invitationer kommer stadig igennem. Resten venter her i klokken.
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 14px", borderBottom: "1px solid " + theme.border, background: theme.surface }}>
        <button
          type="button"
          onClick={() => setShowPrefToggles((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "11px",
            fontWeight: 700,
            color: theme.textMid,
            cursor: "pointer",
            fontFamily: font,
          }}
        >
          {showPrefToggles ? "▼" : "▶"} Push-kanaler {prefsSaving ? "…" : ""}
        </button>
        {showPrefToggles && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {NOTIFICATION_PUSH_CHANNELS.filter((ch) => ch.id !== "system" || profile?.role === "admin").map((ch) => (
              <label
                key={ch.id}
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: theme.text, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={notifPrefs.push[ch.id] !== false}
                  onChange={(e) => {
                    void persistPrefs(mergeNotificationPrefToggle(notifPrefs, ch.id, e.target.checked));
                  }}
                />
                {ch.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "8px 14px", borderBottom: "1px solid " + theme.border, background: theme.surface }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textMid, marginBottom: "6px" }}>
          E-mail {prefsSaving ? "…" : ""}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: theme.textLight, lineHeight: 1.4 }}>
          Nye kampe og makkere samles i én mail kl. 17 — højst én om dagen. Kampe i dag eller i morgen får du med det samme.
        </p>
        {NOTIFICATION_EMAIL_CHANNELS.map((ch) => (
          <label
            key={ch.id}
            style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: theme.text, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={notifPrefs.email?.[ch.id] === true}
              onChange={(e) => {
                void persistPrefs(mergeNotificationEmailToggle(notifPrefs, ch.id, e.target.checked));
              }}
            />
            {ch.label}
          </label>
        ))}
      </div>
    </>
  );
}

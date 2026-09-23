import { useEffect, useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme } from '../lib/platformTheme';
import { invalidateNotificationPrefsCache } from '../lib/notifications';
import { PillTabs } from './PillTabs';
import { ToggleSwitch } from './ToggleSwitch';
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

/** Faste valg til "stille om natten"; en tidligere valgt time vises også. */
const QUIET_START_CHOICES = [21, 22, 23];
const QUIET_END_CHOICES = [6, 7, 8];

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
const hourTabs = (choices, current) => [...new Set([...choices, current])]
  .sort((a, b) => a - b)
  .map((h) => ({ id: String(h), label: hourLabel(h) }));

const sectionStyle = { padding: '16px 18px', borderTop: '1px solid ' + theme.border };
const sectionTitleStyle = { fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: '0 0 10px' };
const helpStyle = { fontSize: 12.5, color: theme.textLight, lineHeight: 1.5, margin: '8px 0 0' };
const smallLabelStyle = { fontSize: 12.5, fontWeight: 600, color: theme.textMid, margin: '12px 0 6px' };

function SettingRow({ title, hint, checked, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '6px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{title}</div>
        {hint ? <div style={{ fontSize: 12.5, color: theme.textLight, lineHeight: 1.45, marginTop: 2 }}>{hint}</div> : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={`${checked ? 'Slå fra' : 'Slå til'}: ${title}`} />
    </div>
  );
}

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

  const pushOff = notifPrefs.pushLevel === 'off';
  const quiet = notifPrefs.quietHours || { enabled: true, start: 22, end: 7 };
  const channels = NOTIFICATION_PUSH_CHANNELS.filter((ch) => ch.id !== 'system' || profile?.role === 'admin');

  return (
    <div style={{ fontFamily: font, background: theme.surface }}>
      <div style={{ ...sectionStyle, borderTop: 'none' }}>
        <h3 style={sectionTitleStyle}>
          Notifikationer på telefonen
          {prefsSaving ? <span style={{ fontSize: 12, fontWeight: 500, color: theme.textLight, marginLeft: 8 }}>Gemmer…</span> : null}
        </h3>
        <PillTabs
          tabs={NOTIFICATION_PUSH_LEVELS.map((lvl) => ({ id: lvl.id, label: lvl.label }))}
          value={notifPrefs.pushLevel || 'all'}
          onChange={(id) => { if (id !== notifPrefs.pushLevel) void persistPrefs(mergeNotificationPushLevel(notifPrefs, id)); }}
          ariaLabel="Notifikationer på telefonen"
          size="sm"
          className="pm-pill-tabs--fill"
        />
        <p style={helpStyle}>
          {pushOff
            ? 'Ingen notifikationer på telefonen. Du ser stadig alt her.'
            : notifPrefs.pushLevel === 'important'
              ? 'Kun invitationer, aflysninger, resultater og påmindelser sendes til telefonen.'
              : 'Alt sendes til telefonen. Du kan vælge enkelte typer fra nedenfor.'}
        </p>
      </div>

      {!pushOff && (
        <div style={sectionStyle}>
          <SettingRow
            title="Stille om natten"
            hint="Vigtige beskeder som aflysninger og invitationer kommer stadig igennem. Resten venter her."
            checked={quiet.enabled !== false}
            onChange={(on) => { void persistPrefs(mergeQuietHours(notifPrefs, { enabled: on })); }}
          />
          {quiet.enabled !== false && (
            <>
              <div style={smallLabelStyle}>Stille fra kl.</div>
              <PillTabs
                tabs={hourTabs(QUIET_START_CHOICES, quiet.start)}
                value={String(quiet.start)}
                onChange={(id) => { void persistPrefs(mergeQuietHours(notifPrefs, { start: Number(id) })); }}
                ariaLabel="Stille fra kl."
                size="sm"
                className="pm-pill-tabs--fill"
              />
              <div style={smallLabelStyle}>Til kl.</div>
              <PillTabs
                tabs={hourTabs(QUIET_END_CHOICES, quiet.end)}
                value={String(quiet.end)}
                onChange={(id) => { void persistPrefs(mergeQuietHours(notifPrefs, { end: Number(id) })); }}
                ariaLabel="Stille til kl."
                size="sm"
                className="pm-pill-tabs--fill"
              />
            </>
          )}
        </div>
      )}

      {!pushOff && (
        <div style={{ ...sectionStyle, paddingTop: 4, paddingBottom: 4 }}>
          <button
            type="button"
            onClick={() => setShowPrefToggles((v) => !v)}
            aria-expanded={showPrefToggles}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: theme.text, textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>Vælg hvad der sendes til telefonen</span>
            <ChevronDown size={16} color={theme.textMid} aria-hidden style={{ transform: showPrefToggles ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showPrefToggles && (
            <div style={{ paddingBottom: 8 }}>
              {channels.map((ch, i) => (
                <div key={ch.id} style={{ borderTop: i ? '1px solid ' + theme.border : undefined }}>
                  <SettingRow
                    title={ch.label}
                    checked={notifPrefs.push[ch.id] !== false}
                    onChange={(on) => { void persistPrefs(mergeNotificationPrefToggle(notifPrefs, ch.id, on)); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Mail</h3>
        {NOTIFICATION_EMAIL_CHANNELS.map((ch) => (
          <SettingRow
            key={ch.id}
            title={ch.label}
            hint="Nye kampe og makkere samles i én mail kl. 17 — højst én om dagen. Kampe i dag eller i morgen får du med det samme."
            checked={notifPrefs.email?.[ch.id] === true}
            onChange={(on) => { void persistPrefs(mergeNotificationEmailToggle(notifPrefs, ch.id, on)); }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * "Indstillinger for beskeder" som sammenfoldet række. Bruges på
 * notifikationssiden (telefon) og i klokke-menuen (computer), så
 * indstillingerne ikke skubber selve beskederne ud af syne.
 */
export function NotificationSettingsDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid ' + theme.border, background: theme.surface }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 13, fontWeight: 600, color: theme.text, textAlign: 'left' }}
      >
        <Settings size={16} color={theme.textMid} aria-hidden />
        <span style={{ flex: 1 }}>Indstillinger for beskeder</span>
        <ChevronDown size={16} color={theme.textMid} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && <NotificationSettingsPanel />}
    </div>
  );
}

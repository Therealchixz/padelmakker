import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { REGIONS, DAYS_OF_WEEK, levelLabel } from '../lib/platformConstants';
import { normalizeStringArrayField } from '../lib/profileUtils';
import {
  normalizeMakkerSearchPrefs,
  describeMakkerFilter,
  isMakkerFilterConfigured,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
  saveMakkerSearchPrefs,
  LEVEL_WINDOW_CHOICES,
  DEFAULT_LEVEL_WINDOW,
} from '../lib/makkerSearchFilterUtils';
import { levelRangeForWindow } from '../lib/padelLevelUtils';
import { formatPlaytomicLevel, profilePlaytomicLevel } from '../lib/padelLevelUtils';
import { ChevronLeft, Bell, Zap } from 'lucide-react';

const labelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: theme.textLight,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '8px',
  display: 'block',
};

export function MakkerSearchFilterPage({ user, showToast }) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const initial = useMemo(
    () => normalizeMakkerSearchPrefs(user?.makker_search_prefs, user),
    [user],
  );
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  const profileLevel = profilePlaytomicLevel(user);
  const filterLevel = resolveMakkerFilterLevel(prefs, user);
  const levelDisplay = levelLabel(filterLevel) || formatPlaytomicLevel(filterLevel);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  const toggleDay = (key) => {
    const cur = normalizeStringArrayField(prefs.days);
    set({
      days: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
    });
  };

  const description = describeMakkerFilter(prefs, user);
  const regionOk = Boolean(resolveMakkerFilterRegion(prefs, user) || prefs.region);
  const levelWindow = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const levelSpan = levelRangeForWindow(filterLevel, levelWindow);

  const handleSave = async () => {
    if (!isMakkerFilterConfigured(prefs, user) && !prefs.region) {
      showToast('Vælg en region før du gemmer.');
      return;
    }
    if ((prefs.notify || prefs.feedVisible) && !regionOk) {
      showToast('Vælg region for at aktivere filteret.');
      return;
    }
    setSaving(true);
    try {
      const patch = await saveMakkerSearchPrefs(
        { ...prefs, myLevel: profileLevel },
        user,
      );
      await updateProfile(patch);
      showToast('Mit makker-filter er gemt');
      navigate('/dashboard/profil');
    } catch {
      showToast('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: font, maxWidth: 520, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/dashboard/profil')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: theme.textMid,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0 16px',
        }}
      >
        <ChevronLeft size={18} aria-hidden />
        Tilbage til profil
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: '0 0 6px' }}>
        Mit makker-filter
      </h1>
      <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 20 }}>
        Få besked når spillere på dit niveau slår &ldquo;søger makker&rdquo; til i Find makker.
        Samme niveau-skala som i kamp-filteret.
      </p>

      <div
        style={{
          background: theme.surfaceAlt,
          border: `1px solid ${description.active ? theme.accent : theme.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 20,
          fontSize: 12,
          color: theme.textMid,
        }}
      >
        <strong style={{ color: theme.text, display: 'block', marginBottom: 4 }}>
          {description.configured ? description.summary : 'Filter ikke fuldt sat'}
        </strong>
        {description.detail}
      </div>

      <div style={labelStyle}>Region</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => set({ region: r })}
            style={{
              ...btn(prefs.region === r),
              textAlign: 'left',
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={labelStyle}>Dit niveau</div>
      <div
        style={{
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 8,
          fontSize: 13,
          color: theme.text,
        }}
      >
        <strong>{formatPlaytomicLevel(profileLevel)}</strong>
        {levelDisplay ? (
          <span style={{ color: theme.textMid, marginLeft: 8 }}>{levelDisplay}</span>
        ) : null}
        <div style={{ fontSize: 11, color: theme.textLight, marginTop: 6 }}>
          Hentes fra din profil. Under Profil → Rediger kan du finjustere.
        </div>
      </div>

      <div style={labelStyle}>Hvor tæt på dit niveau skal makkere være?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {LEVEL_WINDOW_CHOICES.map(({ value, label, hint }) => {
          const active = (prefs.levelWindow ?? DEFAULT_LEVEL_WINDOW) === value;
          const tolLabel = `±${String(value).replace('.', ',')}`;
          return (
            <button
              key={value}
              type="button"
              onClick={() => set({ levelWindow: value })}
              style={{
                ...btn(active),
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: active ? theme.onAccent : theme.text }}>{label}</span>
                {hint ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      marginLeft: 6,
                      color: active ? 'rgba(255,255,255,0.82)' : theme.textLight,
                    }}
                  >
                    {hint}
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: active ? theme.onAccent : theme.textMid,
                }}
              >
                {tolLabel}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: theme.textLight, marginBottom: 18, lineHeight: 1.45 }}>
        Med niveau {formatPlaytomicLevel(filterLevel)} matcher vi spillere mellem{' '}
        <strong>{formatPlaytomicLevel(levelSpan.min)}</strong> og{' '}
        <strong>{formatPlaytomicLevel(levelSpan.max)}</strong> der søger makker.
      </p>

      <div style={labelStyle}>Ugedage du vil spille (valgfrit)</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Vi matcher kun spillere der har mindst én af disse dage i profilen. Tom = alle dage.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const active = normalizeStringArrayField(prefs.days).includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              style={{
                flex: 1,
                padding: '8px 2px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                border: `1.5px solid ${active ? theme.accent : theme.border}`,
                background: active ? theme.accent : theme.surface,
                color: active ? '#fff' : theme.textMid,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16, marginBottom: 20 }}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Kanaler</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: theme.surfaceAlt,
            border: `1px solid ${prefs.notify ? theme.accent : theme.border}`,
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Bell size={18} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Notifikationer</div>
              <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
                Push og in-app når en spiller søger makker og passer (max 2 om dagen i alt med kamp-filter).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => set({ notify: !prefs.notify })}
            aria-pressed={prefs.notify}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: prefs.notify ? theme.accent : theme.border,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: prefs.notify ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: theme.surfaceAlt,
            border: `1px solid ${prefs.feedVisible ? theme.accent : theme.border}`,
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Zap size={18} color={theme.warm} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Vis at jeg søger makker (24t)</div>
              <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
                Du vises som aktiv i Find makker. Slås automatisk fra efter 24 timer.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => set({ feedVisible: !prefs.feedVisible })}
            aria-pressed={prefs.feedVisible}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: prefs.feedVisible ? theme.accent : theme.border,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: prefs.feedVisible ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        style={{
          ...btn(true),
          width: '100%',
          padding: '14px',
          fontSize: 14,
          fontWeight: 700,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Gemmer…' : 'Gem filter'}
      </button>
    </div>
  );
}

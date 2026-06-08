import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { REGIONS, DAYS_OF_WEEK, AVAILABILITY, levelLabel } from '../lib/platformConstants';
import {
  MAKKER_AVAILABILITY_FLEXIBLE,
  availabilityMeansAllTimeSlots,
} from '../lib/makkerFilterMatch';
import { normalizeStringArrayField } from '../lib/profileUtils';
import {
  normalizeMatchSearchPrefs,
  describeMatchFilter,
  isMatchFilterConfigured,
  resolveFilterRegion,
  resolveFilterLevel,
  buildProfilePatchFromMatchSearchPrefs,
  LEVEL_WINDOW_CHOICES,
  DEFAULT_LEVEL_WINDOW,
} from '../lib/matchSearchFilterUtils';
import { levelRangeForWindow } from '../lib/padelLevelUtils';
import { formatPlaytomicLevel, profilePlaytomicLevel } from '../lib/padelLevelUtils';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import { ChevronLeft } from 'lucide-react';
import { filterReturnFromState, filterReturnBackLabel } from '../lib/filterReturnNavigation';

const labelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: theme.textLight,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '8px',
  display: 'block',
};

export function MatchSearchFilterPage({ user, showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = filterReturnFromState(location.state);
  const returnLabel = filterReturnBackLabel(returnTo);
  const { updateProfile } = useAuth();
  const initial = useMemo(
    () => normalizeMatchSearchPrefs(user?.match_search_prefs, user),
    [user],
  );
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  const profileLevel = profilePlaytomicLevel(user);
  const filterLevel = resolveFilterLevel(prefs, user);
  const levelDisplay = levelLabel(filterLevel) || formatPlaytomicLevel(filterLevel);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  const toggleDay = (key) => {
    const cur = normalizeStringArrayField(prefs.days);
    set({
      days: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
    });
  };

  const toggleAvailability = (slot) => {
    if (slot === MAKKER_AVAILABILITY_FLEXIBLE) {
      set({ availability: [] });
      return;
    }
    const cur = normalizeStringArrayField(prefs.availability);
    set({
      availability: cur.includes(slot) ? cur.filter((x) => x !== slot) : [...cur, slot],
    });
  };

  const allTimeSlots = availabilityMeansAllTimeSlots(prefs.availability);

  const description = describeMatchFilter(prefs, user);
  const regionOk = Boolean(resolveFilterRegion(prefs, user) || prefs.region);
  const levelWindow = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const levelSpan = levelRangeForWindow(filterLevel, levelWindow);

  const handleSave = async () => {
    if (!isMatchFilterConfigured(prefs, user) && !prefs.region) {
      showToast('Vælg en region før du gemmer.');
      return;
    }
    if ((prefs.notify || prefs.feedVisible) && !regionOk) {
      showToast('Vælg region for at aktivere filteret.');
      return;
    }
    setSaving(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      const patch = buildProfilePatchFromMatchSearchPrefs(
        { ...prefs, myLevel: profileLevel },
        user,
      );
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast('Mit kamp-filter er gemt');
      navigate(returnTo);
    } catch (err) {
      console.warn('save match filter:', err?.message || err);
      showToast('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: font, maxWidth: 520, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate(returnTo)}
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
        Tilbage til {returnLabel}
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: '0 0 6px' }}>
        Mit kamp-filter
      </h1>
      <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 20 }}>
        Dette styrer hvornår du får besked og hvilke kampe der matcher. Slå aktiv søgning til/fra på
        Hjem eller Kampe — her finjusterer du region, niveau og tid.
      </p>

      <div
        style={{
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
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
          Hentes fra din profil. Under Profil → Rediger kan du finjustere (fx 3,3 i stedet for 3,0 eller 3,5).
        </div>
      </div>

      <div style={labelStyle}>Hvor tæt på dit niveau skal kampe være?</div>
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
        Med niveau {formatPlaytomicLevel(filterLevel)} matcher vi kampe mellem{' '}
        <strong>{formatPlaytomicLevel(levelSpan.min)}</strong> og{' '}
        <strong>{formatPlaytomicLevel(levelSpan.max)}</strong>.
        I padel er selv 0,3–0,4 en tydelig forskel — vælg snævert for de mest fair kampe.
      </p>

      <div style={labelStyle}>Hvornår søger du kamp? (valgfrit)</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Vælg tidsrum på dagen — andre ser det når du vises som søger kamp. Flexibel / intet valg = alle tidsrum.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {AVAILABILITY.map((slot) => {
          const active =
            slot === MAKKER_AVAILABILITY_FLEXIBLE
              ? allTimeSlots
              : !allTimeSlots && normalizeStringArrayField(prefs.availability).includes(slot);
          return (
            <button
              key={slot}
              type="button"
              onClick={() => toggleAvailability(slot)}
              style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
            >
              {slot}
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Ugedage (valgfrit)</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Vi viser kun spillere der har mindst én af disse dage. Tom = alle dage.
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
                color: active ? theme.onAccent : theme.textMid,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
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

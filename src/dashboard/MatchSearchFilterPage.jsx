import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { DAYS_OF_WEEK, AVAILABILITY } from '../lib/platformConstants';
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
} from '../lib/matchSearchFilterUtils';
import {
  customFilterLevelBounds,
  formatPlaytomicLevel,
  formatPlaytomicLevelRange,
  levelRangeForWindow,
  profilePlaytomicLevel,
} from '../lib/padelLevelUtils';
import { LevelRangeSlider } from '../components/LevelRangeSlider';
import { RegionPickerRow } from '../components/RegionPickerRow';
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
  // Selvvalgt spænd (levelMin/levelMax) eller "kampe for mit niveau".
  const customLevel = customFilterLevelBounds(prefs);

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
  const chooseOwnLevel = () => set({ levelMin: undefined, levelMax: undefined });
  const chooseCustomLevel = () => {
    if (customLevel) return;
    const start = levelRangeForWindow(filterLevel, 0.2);
    set({ levelMin: start.min, levelMax: start.max });
  };

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
      const patch = buildProfilePatchFromMatchSearchPrefs(
        { ...prefs, myLevel: profileLevel },
        user,
      );
      await updateProfile(patch);
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
    <div style={{ fontFamily: font }}>
      <div className="pm-subpage-head">
        <button
          type="button"
          className="pm-subpage-head-back"
          onClick={() => navigate(returnTo)}
          aria-label={`Tilbage til ${returnLabel}`}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <h2 className="pm-subpage-head-title">Kamp-filter</h2>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px 0' }}>
      <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 20 }}>
        Vælg hvilke kampe du vil have besked om. Du slår beskederne til og fra på Hjem eller Kampe.
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
          lineHeight: 1.45,
        }}
      >
        <strong style={{ color: theme.text, display: 'block', marginBottom: 4 }}>
          {description.configured ? description.summary : 'Filter ikke fuldt sat'}
        </strong>
        {description.detail}
      </div>

      <div style={labelStyle}>Region</div>
      <RegionPickerRow
        value={prefs.region || resolveFilterRegion(prefs, user)}
        onChange={(r) => set({ region: r })}
        sheetHint="Du får også besked om kampe i nabo-regionerne."
      />

      {/* Samme regel som besked om nye kampe (match_fits_watcher_level i
          databasen): kampens niveau skal passe inden for den ramme, du vælger. */}
      <div style={labelStyle}>Kampens niveau</div>
      <p style={{ fontSize: 12, color: theme.textMid, margin: '0 0 8px', lineHeight: 1.45 }}>
        Dit niveau er <strong style={{ color: theme.text }}>{formatPlaytomicLevel(profileLevel)}</strong>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: customLevel ? 10 : 20 }}>
        {[
          {
            key: 'own',
            active: !customLevel,
            onClick: chooseOwnLevel,
            title: 'Kampe for mit niveau',
            hint: `Kampe, hvor ${formatPlaytomicLevel(filterLevel)} er inden for kampens niveau`,
          },
          {
            key: 'custom',
            active: Boolean(customLevel),
            onClick: chooseCustomLevel,
            title: 'Vælg selv fra og til',
            hint: 'Kampe, hvis niveau overlapper dit spænd',
          },
        ].map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.active}
            onClick={o.onClick}
            style={{
              ...btn(o.active),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>{o.title}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: o.active ? 'var(--pm-on-accent)' : theme.textLight,
                opacity: o.active ? 0.85 : 1,
              }}
            >
              {o.hint}
            </span>
          </button>
        ))}
      </div>
      {customLevel ? (
        <>
          <div className="pm-level-range-box">
            <LevelRangeSlider
              minVal={customLevel.min}
              maxVal={customLevel.max}
              step={0.1}
              onMinChange={(v) => set({ levelMin: v, levelMax: customLevel.max })}
              onMaxChange={(v) => set({ levelMin: customLevel.min, levelMax: v })}
            />
          </div>
          <p className="pm-level-range-hint" style={{ marginBottom: 20 }}>
            Du får besked om kampe, hvis niveau overlapper{' '}
            {formatPlaytomicLevelRange(customLevel.min, customLevel.max)}.
          </p>
        </>
      ) : null}

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
        Kun kampe på disse dage. Tom = alle dage.
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
    </div>
  );
}

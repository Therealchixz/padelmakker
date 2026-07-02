import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { REGIONS, DAYS_OF_WEEK, INTENTS } from '../lib/platformConstants';
import { normalizeStringArrayField } from '../lib/profileUtils';
import {
  normalizeMakkerSearchPrefs,
  describeMakkerFilter,
  isMakkerFilterConfigured,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
  buildProfilePatchFromMakkerSearchPrefs,
  LEVEL_WINDOW_CHOICES,
  DEFAULT_LEVEL_WINDOW,
  MAKKER_PARTNER_COURT_SIDES,
  MAKKER_INTENT_MODES,
  MAKKER_PARTNER_LEVEL_FILTERS,
  PLAY_STYLES,
  AVAILABILITY,
} from '../lib/makkerSearchFilterUtils';
import {
  levelRangeForMakkerPartnerPref,
  normalizeMakkerPartnerLevel,
  MAKKER_AVAILABILITY_FLEXIBLE,
  availabilityMeansAllTimeSlots,
} from '../lib/makkerFilterMatch';
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

function canonicalIntentKey(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('traening') || v.includes('træning')) return 'træning';
  if (v.includes('konkurrence')) return 'konkurrence';
  if (v.includes('hygge')) return 'hygge';
  if (v.includes('fast')) return 'fast_makker';
  if (v.includes('turnering')) return 'turnering';
  return v.replace(/\s+/g, '_');
}

function effectivePartnerLevel(partnerLevel, profile) {
  const raw = partnerLevel ?? '';
  if (raw) return raw;
  return normalizeMakkerPartnerLevel('', profile) || 'same';
}

function toleranceSectionTitle(partnerLevel) {
  if (partnerLevel === 'stronger') return 'Hvor meget over dit niveau?';
  if (partnerLevel === 'weaker') return 'Hvor meget under dit niveau?';
  return 'Hvor tæt på dit niveau?';
}

function levelRangeSummary(min, max) {
  return `${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`;
}

export function MakkerSearchFilterPage({ user, showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = filterReturnFromState(location.state);
  const returnLabel = filterReturnBackLabel(returnTo);
  const { updateProfile } = useAuth();
  const initial = useMemo(
    () => normalizeMakkerSearchPrefs(user?.makker_search_prefs, user),
    [user],
  );
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  const profileLevel = profilePlaytomicLevel(user);
  const filterLevel = resolveMakkerFilterLevel(prefs, user);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  const toggleDay = (key) => {
    const cur = normalizeStringArrayField(prefs.days);
    set({
      days: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
    });
  };

  const toggleIntent = (value) => {
    const key = canonicalIntentKey(value);
    const cur = normalizeStringArrayField(prefs.intents);
    set({
      intents: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
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

  const description = describeMakkerFilter(prefs, user);
  const regionOk = Boolean(resolveMakkerFilterRegion(prefs, user) || prefs.region);
  const levelWindow = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const partnerLevel = prefs.partnerLevel ?? '';
  const effectivePref = effectivePartnerLevel(partnerLevel, user);
  const showTolerance = partnerLevel !== 'wide';
  const levelSpan = levelRangeForMakkerPartnerPref(
    filterLevel,
    levelWindow,
    partnerLevel,
    user,
  );

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
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      const patch = buildProfilePatchFromMakkerSearchPrefs(
        { ...prefs, myLevel: profileLevel },
        user,
      );
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast('Mit makker-filter er gemt');
      navigate(returnTo);
    } catch (err) {
      console.warn('save makker filter:', err?.message || err);
      showToast('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const selectedIntents = normalizeStringArrayField(prefs.intents);

  return (
    <div style={{ fontFamily: font }}>
      {/* Topbar — matches mockup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(10px, calc(env(safe-area-inset-top) + 8px)) 14px 10px', borderBottom: '1px solid ' + theme.border, background: theme.surface, marginBottom: 0 }}>
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid ' + theme.border, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          aria-label="Tilbage"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <h2 style={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Filtre</h2>
        <button
          type="button"
          onClick={() => setPrefs(normalizeMakkerSearchPrefs({}, user))}
          style={{ fontSize: '11.5px', fontWeight: 600, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, padding: '4px 0' }}
        >
          Nulstil
        </button>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px 0' }}>

      <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 16 }}>
        Dette styrer hvornår du får besked og hvilke makkere der matcher. Slå aktiv søgning til/fra på
        Hjem eller Find makker — her finjusterer du region, niveau og spilletider.
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

      <div style={labelStyle}>Baneside på makker</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Hvilken side skal din makker primært spille i double?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
        {MAKKER_PARTNER_COURT_SIDES.map(({ value, label, hint }) => {
          const active = (prefs.partnerCourtSide || 'any') === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => set({ partnerCourtSide: value })}
              style={{
                ...btn(active),
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600, display: 'block' }}>{label}</span>
              {hint ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: active ? 'rgba(255,255,255,0.82)' : theme.textLight,
                  }}
                >
                  {hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Spillestil</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {[{ value: 'all', label: 'Alle' }, ...PLAY_STYLES.map((s) => ({ value: s, label: s }))].map(
          ({ value, label }) => {
            const active = (prefs.playStyle || 'all') === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set({ playStyle: value })}
                style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
              >
                {label}
              </button>
            );
          },
        )}
      </div>

      <div style={labelStyle}>Intention (valgfrit)</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Tom = alle intentioner. Vælg én eller flere.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {INTENTS.map(({ value, label }) => {
          const key = canonicalIntentKey(value);
          const active = selectedIntents.some((x) => canonicalIntentKey(x) === key);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleIntent(value)}
              style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {selectedIntents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {MAKKER_INTENT_MODES.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ intentMode: value })}
              style={{
                ...btn((prefs.intentMode || 'compatible') === value),
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>{label}</span>
              {hint ? <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.85 }}>{hint}</span> : null}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: '14px',
          marginBottom: 18,
        }}
      >
        <div style={{ ...labelStyle, marginBottom: 6 }}>Makker-niveau</div>
        <p style={{ fontSize: 12, color: theme.textMid, margin: '0 0 12px', lineHeight: 1.45 }}>
          Dit niveau: <strong style={{ color: theme.text }}>{formatPlaytomicLevel(profileLevel)}</strong>
          <span style={{ color: theme.textLight }}> · fra profilen</span>
        </p>

        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 6 }}>
          Hvad leder du efter?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MAKKER_PARTNER_LEVEL_FILTERS.map(({ value, label, hint }) => {
            const active = partnerLevel === value;
            const preview = levelRangeForMakkerPartnerPref(
              filterLevel,
              levelWindow,
              value,
              user,
            );
            const rangeText = levelRangeSummary(preview.min, preview.max);
            return (
              <button
                key={value || 'profile'}
                type="button"
                onClick={() => set({ partnerLevel: value })}
                style={{
                  ...btn(active),
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, display: 'block' }}>{label}</span>
                  {hint ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
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
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? theme.onAccent : theme.textMid,
                  }}
                >
                  {rangeText}
                </span>
              </button>
            );
          })}
        </div>

        {showTolerance ? (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 8 }}>
              {toleranceSectionTitle(effectivePref)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LEVEL_WINDOW_CHOICES.map(({ value, label }) => {
                const active = (prefs.levelWindow ?? DEFAULT_LEVEL_WINDOW) === value;
                const tol = `±${String(value).replace('.', ',')}`;
                const { min, max } = levelRangeForMakkerPartnerPref(
                  filterLevel,
                  value,
                  partnerLevel,
                  user,
                );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ levelWindow: value })}
                    title={`${label}: ${levelRangeSummary(min, max)}`}
                    aria-label={`${label}: niveau ${levelRangeSummary(min, max)}`}
                    style={{
                      ...btn(active),
                      padding: '8px 10px',
                      fontSize: 11,
                      lineHeight: 1.3,
                      textAlign: 'center',
                      minWidth: 72,
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 700 }}>{tol}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 500,
                        opacity: active ? 0.9 : 0.75,
                        marginTop: 2,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              style={{
                fontSize: 11,
                color: theme.textMid,
                margin: '8px 0 0',
                lineHeight: 1.4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Resultat: niveau <strong style={{ color: theme.text }}>{levelRangeSummary(levelSpan.min, levelSpan.max)}</strong>
            </p>
          </div>
        ) : null}

        <p
          style={{
            fontSize: 11,
            color: theme.textLight,
            margin: '14px 0 0',
            lineHeight: 1.45,
            paddingTop: showTolerance ? 0 : 14,
            borderTop: showTolerance ? 'none' : `1px solid ${theme.border}`,
          }}
        >
          {partnerLevel === 'wide' ? (
            <>
              Vi matcher <strong>alle niveauer</strong> i regionen der søger makker.
            </>
          ) : (
            <>
              Vi matcher spillere mellem{' '}
              <strong>{formatPlaytomicLevel(levelSpan.min)}</strong> og{' '}
              <strong>{formatPlaytomicLevel(levelSpan.max)}</strong> der søger makker.
            </>
          )}
        </p>
      </div>

      <div style={labelStyle}>Hvornår kan du spille? (valgfrit)</div>
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 8px', lineHeight: 1.45 }}>
        Vælg konkrete tidsrum, eller <strong>Flexibel</strong> / intet valg for alle tidsrum.
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

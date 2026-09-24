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
  DEFAULT_LEVEL_WINDOW,
  PLAY_STYLES,
  AVAILABILITY,
} from '../lib/makkerSearchFilterUtils';
import {
  levelRangeForMakkerPartnerPref,
  MAKKER_AVAILABILITY_FLEXIBLE,
  availabilityMeansAllTimeSlots,
} from '../lib/makkerFilterMatch';
import { formatPlaytomicLevel, profilePlaytomicLevel } from '../lib/padelLevelUtils';
import { notifyMakkerWatchersForProfile, makkerMatchToast } from '../lib/makkerWatchUtils';
import { isProfileMakkerFeedVisible } from '../lib/seekingFeedTtl';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { ToggleSwitch } from '../components/ToggleSwitch';
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



/**
 * Ét samlet valg for makkerens niveau. Gemmes som de samme to felter som før
 * (partnerLevel + levelWindow), så matchningen ikke ændres.
 */
const MAKKER_LEVEL_CHOICES = [
  { key: 'close', label: 'Tæt på mit niveau', partnerLevel: 'same', levelWindow: 0.2 },
  { key: 'broad', label: 'Omkring mit niveau, lidt bredere', partnerLevel: 'same', levelWindow: 0.5 },
  { key: 'stronger', label: 'Lidt stærkere end mig', partnerLevel: 'stronger', levelWindow: 0.2 },
  { key: 'weaker', label: 'Lidt svagere end mig', partnerLevel: 'weaker', levelWindow: 0.2 },
  { key: 'wide', label: 'Alle niveauer', partnerLevel: 'wide', levelWindow: 0.2 },
];

const COURT_SIDE_CHOICES = [
  { value: 'any', label: 'Ligegyldigt' },
  { value: 'venstre', label: 'Venstre side' },
  { value: 'hojre', label: 'Højre side' },
];

function levelChoiceKey(partnerLevel, levelWindow) {
  const pref = partnerLevel || 'same';
  if (pref === 'same') return (Number(levelWindow) || DEFAULT_LEVEL_WINDOW) > 0.3 ? 'broad' : 'close';
  return pref;
}

function levelRangeSummary(min, max) {
  return `${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`;
}

function countMakkerFilterExtras(p) {
  return [
    (p.partnerCourtSide || 'any') !== 'any',
    (p.playStyle || 'all') !== 'all',
    normalizeStringArrayField(p.intents).length > 0,
  ].filter(Boolean).length;
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
  // Valgfrie felter foldes ud af sig selv, hvis noget af dem allerede er valgt.
  const [moreOpen, setMoreOpen] = useState(() => countMakkerFilterExtras(initial) > 0);

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
  const selectedLevelChoice = levelChoiceKey(prefs.partnerLevel, prefs.levelWindow);

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
      const wasMakkerOn = isProfileMakkerFeedVisible(user);
      const patch = buildProfilePatchFromMakkerSearchPrefs(
        { ...prefs, myLevel: profileLevel },
        user,
      );
      await updateProfile(patch);
      if (isProfileMakkerFeedVisible({ ...user, ...patch }) && !wasMakkerOn && user?.id) {
        const res = await notifyMakkerWatchersForProfile(user.id);
        const matchMsg = makkerMatchToast(res.matches);
        showToast(matchMsg || 'Mit makker-filter er gemt');
      } else {
        showToast('Mit makker-filter er gemt');
      }
      navigate(returnTo);
    } catch (err) {
      console.warn('save makker filter:', err?.message || err);
      showToast('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  const selectedIntents = normalizeStringArrayField(prefs.intents);
  const extrasCount = countMakkerFilterExtras(prefs);

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
        <h2 className="pm-subpage-head-title">Filtre</h2>
        <button
          type="button"
          className="pm-subpage-head-action"
          onClick={() => setPrefs(normalizeMakkerSearchPrefs({}, user))}
        >
          Nulstil
        </button>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px 0' }}>

      <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 16 }}>
        Vælg hvilke makkere der passer til dig. Du slår søgningen til og fra på Hjem eller Find makker.
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={prefs.region === r}
            onClick={() => set({ region: r })}
            style={{ ...btn(prefs.region === r), padding: '10px 8px', fontSize: 13 }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Ét valg for niveau. Før skulle man først vælge retning (svagere/samme/
          stærkere/fra profilen) og derefter en tolerance på ±0,1-0,5. */}
      <div style={labelStyle}>Makkerens niveau</div>
      <p style={{ fontSize: 12, color: theme.textMid, margin: '0 0 8px', lineHeight: 1.45 }}>
        Dit niveau er <strong style={{ color: theme.text }}>{formatPlaytomicLevel(profileLevel)}</strong>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {MAKKER_LEVEL_CHOICES.map((choice) => {
          const active = choice.key === selectedLevelChoice;
          const range = levelRangeForMakkerPartnerPref(filterLevel, choice.levelWindow, choice.partnerLevel, user);
          return (
            <button
              key={choice.key}
              type="button"
              aria-pressed={active}
              onClick={() => set({ partnerLevel: choice.partnerLevel, levelWindow: choice.levelWindow })}
              style={{
                ...btn(active),
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontWeight: 600 }}>{choice.label}</span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {choice.partnerLevel === 'wide' ? 'Alle' : levelRangeSummary(range.min, range.max)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Hvornår kan du spille? (valgfrit)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {AVAILABILITY.map((slot) => {
          const active =
            slot === MAKKER_AVAILABILITY_FLEXIBLE
              ? allTimeSlots
              : !allTimeSlots && normalizeStringArrayField(prefs.availability).includes(slot);
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={active}
              onClick={() => toggleAvailability(slot)}
              style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
            >
              {slot === MAKKER_AVAILABILITY_FLEXIBLE ? 'Alle tider' : slot}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const active = normalizeStringArrayField(prefs.days).includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
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
      <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 20px', lineHeight: 1.45 }}>
        Intet valgt = alle dage og tider.
      </p>

      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 44,
          padding: '10px 0',
          marginBottom: moreOpen ? 12 : 20,
          background: 'none',
          border: 'none',
          borderTop: `1px solid ${theme.border}`,
          color: theme.text,
          fontFamily: font,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span>
          Flere valg (valgfrit)
          {extrasCount > 0 ? (
            <span style={{ fontWeight: 500, color: theme.textMid }}> · {extrasCount} valgt</span>
          ) : null}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {moreOpen ? (
        <>
          <div style={labelStyle}>Makkerens side på banen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {COURT_SIDE_CHOICES.map(({ value, label }) => {
              const active = (prefs.partnerCourtSide || 'any') === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ partnerCourtSide: value })}
                  style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
                >
                  {label}
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
                    aria-pressed={active}
                    onClick={() => set({ playStyle: value })}
                    style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>

          <div style={labelStyle}>Hvad vil du spille for?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {INTENTS.map(({ value, label }) => {
              const key = canonicalIntentKey(value);
              const active = selectedIntents.some((x) => canonicalIntentKey(x) === key);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleIntent(value)}
                  style={{ ...btn(active), padding: '6px 12px', fontSize: 12 }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {selectedIntents.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>
                Kun spillere, der har valgt præcis det samme
              </span>
              <ToggleSwitch
                checked={prefs.intentMode === 'exact'}
                onChange={(on) => set({ intentMode: on ? 'exact' : 'compatible' })}
                ariaLabel="Kun spillere, der har valgt præcis det samme"
              />
            </div>
          ) : (
            <p style={{ fontSize: 11, color: theme.textLight, margin: '0 0 18px', lineHeight: 1.45 }}>
              Intet valgt = alle.
            </p>
          )}
        </>
      ) : null}

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

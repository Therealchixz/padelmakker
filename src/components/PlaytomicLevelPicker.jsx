import { theme } from '../lib/platformTheme';
import {
  LEVELS,
  LEVEL_DESCS,
  defaultLevelForPreset,
  levelDescriptionForNum,
  levelLabel,
  levelMatchesPreset,
} from '../lib/platformConstants';
import {
  clampPlaytomicLevel,
  formatPlaytomicLevel,
  PLAYTOMIC_LEVEL_MIN,
  PLAYTOMIC_LEVEL_MAX,
} from '../lib/padelLevelUtils';

/**
 * Vælg padel-niveau (1.0–7.0) med presets + finjustering (fx 3.3).
 * @param {number|null|undefined} value
 * @param {(n: number) => void} onChange
 */
export function PlaytomicLevelPicker({ value, onChange }) {
  const hasValue = value != null && value !== '' && Number.isFinite(Number(value));
  const level = hasValue ? clampPlaytomicLevel(value) : null;
  const desc = level != null ? levelDescriptionForNum(level) : null;
  const shortLabel = level != null ? levelLabel(level) : null;

  const setLevel = (n) => onChange(clampPlaytomicLevel(n));

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {LEVELS.map((l) => {
          const preset = defaultLevelForPreset(l);
          const active = level != null && levelMatchesPreset(level, l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(preset)}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 8,
                border: `1.5px solid ${active ? theme.accent : theme.border}`,
                background: active ? theme.accentBg : theme.surface,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: active ? theme.accent : theme.text }}>
                  {l}
                </span>
                {active && (
                  <span style={{ fontSize: 12, color: theme.accent, fontWeight: 700 }}>✓</span>
                )}
              </div>
              {active && (
                <span style={{ fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>
                  {LEVEL_DESCS[l]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: theme.surfaceAlt,
          border: `1px solid ${hasValue ? theme.accent : theme.border}`,
          borderRadius: 10,
          padding: '14px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Finjuster dit niveau
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <input
            type="range"
            min={PLAYTOMIC_LEVEL_MIN}
            max={PLAYTOMIC_LEVEL_MAX}
            step={0.1}
            value={level ?? PLAYTOMIC_LEVEL_MIN}
            disabled={!hasValue}
            onChange={(e) => setLevel(Number(e.target.value))}
            style={{ flex: 1, accentColor: theme.accent }}
            aria-label="Træk for at justere niveau"
          />
          <input
            type="number"
            min={PLAYTOMIC_LEVEL_MIN}
            max={PLAYTOMIC_LEVEL_MAX}
            step={0.1}
            value={level ?? ''}
            placeholder="—"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return;
              setLevel(Number(raw));
            }}
            style={{
              width: 64,
              padding: '8px 6px',
              fontSize: 15,
              fontWeight: 700,
              textAlign: 'center',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              fontFamily: 'inherit',
            }}
            aria-label="Niveau med ét decimal"
          />
        </div>
        {!hasValue ? (
          <p style={{ fontSize: 12, color: theme.textLight, margin: 0, lineHeight: 1.45 }}>
            Vælg et udgangspunkt ovenfor, og justér derefter — fx 3,3 i stedet for 3,0 eller 3,5.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: '0 0 4px' }}>
              {formatPlaytomicLevel(level)}
              {shortLabel ? (
                <span style={{ fontWeight: 600, color: theme.textMid, marginLeft: 8 }}>{shortLabel}</span>
              ) : null}
            </p>
            {desc && (
              <p style={{ fontSize: 12, color: theme.textMid, margin: 0, lineHeight: 1.45 }}>{desc}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

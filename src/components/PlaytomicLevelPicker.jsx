import { theme, btn } from '../lib/platformTheme';
import {
  LEVELS,
  defaultLevelForPreset,
  levelDescriptionForNum,
  levelLabel,
} from '../lib/platformConstants';
import {
  clampPlaytomicLevel,
  formatPlaytomicLevel,
  PLAYTOMIC_LEVEL_MIN,
  PLAYTOMIC_LEVEL_MAX,
  DEFAULT_PLAYTOMIC_LEVEL,
} from '../lib/padelLevelUtils';

const PRESET_SHORT = {
  'Begynder (1.0–1.9)': 'Begynder',
  'Let øvet (2.0–2.9)': 'Let øvet',
  'Øvet (3.0)': '3.0',
  'Avanceret øvet (3.5)': '3.5',
  'Meget øvet (4.0–4.9)': '4–5',
  'Elite (5.0–7.0)': 'Elite',
};

/**
 * Ét samlet niveau-valg: slider/tal + kompakte genveje (ingen dobbelt liste).
 * @param {number|null|undefined} value
 * @param {(n: number) => void} onChange
 */
export function PlaytomicLevelPicker({ value, onChange }) {
  const level = clampPlaytomicLevel(
    value != null && value !== '' && Number.isFinite(Number(value)) ? value : DEFAULT_PLAYTOMIC_LEVEL,
  );
  const desc = levelDescriptionForNum(level);
  const shortLabel = levelLabel(level);

  const setLevel = (n) => onChange(clampPlaytomicLevel(n));

  return (
    <div
      style={{
        background: theme.surfaceAlt,
        border: `1px solid ${theme.accent}`,
        borderRadius: 10,
        padding: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: theme.accent, lineHeight: 1 }}>
          {formatPlaytomicLevel(level)}
        </span>
        {shortLabel && (
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>{shortLabel}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <input
          type="range"
          min={PLAYTOMIC_LEVEL_MIN}
          max={PLAYTOMIC_LEVEL_MAX}
          step={0.1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          style={{ flex: 1, accentColor: theme.accent }}
          aria-label="Træk for at justere niveau"
        />
        <input
          type="number"
          min={PLAYTOMIC_LEVEL_MIN}
          max={PLAYTOMIC_LEVEL_MAX}
          step={0.1}
          value={level}
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

      {desc && (
        <p style={{ fontSize: 12, color: theme.textMid, margin: '0 0 14px', lineHeight: 1.45 }}>{desc}</p>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 8 }}>
        Hurtig valg
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEVELS.map((l) => {
          const preset = defaultLevelForPreset(l);
          const active = Math.abs(level - preset) < 0.05;
          const chip = PRESET_SHORT[l] || l;
          return (
            <button
              key={l}
              type="button"
              title={l}
              onClick={() => setLevel(preset)}
              style={{
                ...btn(active),
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

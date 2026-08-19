import { theme } from '../lib/platformTheme';
import {
  clampPlaytomicLevel,
  formatPlaytomicLevel,
  PLAYTOMIC_LEVEL_MIN,
  PLAYTOMIC_LEVEL_MAX,
} from '../lib/padelLevelUtils';

const numberInputStyle = {
  width: '100%',
  padding: '8px 6px',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'center',
  borderRadius: 8,
  border: `1px solid ${theme.border}`,
  fontFamily: 'inherit',
  color: theme.accent,
  background: theme.surface,
  boxSizing: 'border-box',
};

/**
 * Dual-thumb niveau-slider (Playtomic 1.0–7.0). Genbruges i opret-kamp og
 * opret-turnering. Værdier vises i Fra/Til-felter — ikke som overlappende badges på sporet.
 */
export function LevelRangeSlider({
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  min = PLAYTOMIC_LEVEL_MIN,
  max = PLAYTOMIC_LEVEL_MAX,
  step = 0.1,
}) {
  const toPercent = (v) => ((v - min) / (max - min)) * 100;

  const setMin = (raw) => {
    const v = clampPlaytomicLevel(raw, minVal);
    if (v < maxVal) onMinChange(v);
  };

  const setMax = (raw) => {
    const v = clampPlaytomicLevel(raw, maxVal);
    if (v > minVal) onMaxChange(v);
  };

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 10,
          alignItems: 'end',
          marginBottom: 14,
        }}
      >
        <label style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, marginBottom: 6 }}>
            Fra
          </span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={formatPlaytomicLevel(minVal)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return;
              setMin(Number(raw));
            }}
            style={numberInputStyle}
            aria-label="Mindste niveau"
          />
        </label>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: theme.textLight,
            paddingBottom: 10,
            userSelect: 'none',
          }}
          aria-hidden
        >
          –
        </span>
        <label style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, marginBottom: 6 }}>
            Til
          </span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={formatPlaytomicLevel(maxVal)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return;
              setMax(Number(raw));
            }}
            style={numberInputStyle}
            aria-label="Højeste niveau"
          />
        </label>
      </div>

      <div style={{ position: 'relative', height: 32, marginBottom: 8 }}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 4,
            background: 'var(--pm-border)',
            borderRadius: 2,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${toPercent(minVal)}%`,
            right: `${100 - toPercent(maxVal)}%`,
            height: 4,
            background: 'var(--pm-navy)',
            borderRadius: 2,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v < maxVal) onMinChange(v);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: minVal > maxVal - step ? 5 : 4,
            margin: 0,
          }}
          className="pm-range-input"
          aria-label="Træk for mindste niveau"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > minVal) onMaxChange(v);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 4,
            margin: 0,
          }}
          className="pm-range-input"
          aria-label="Træk for højeste niveau"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
        {[1, 2, 3, 4, 5, 6, 7].map((l) => (
          <span key={l} style={{ fontSize: 10, color: 'var(--pm-text-light)' }}>
            {l === 7 ? '7.0' : `${l}.0`}
          </span>
        ))}
      </div>
    </div>
  );
}

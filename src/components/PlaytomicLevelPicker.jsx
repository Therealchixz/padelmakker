import { theme } from '../lib/platformTheme';
import {
  levelBandTitleForNum,
  levelDescriptionForNum,
} from '../lib/platformConstants';
import {
  clampPlaytomicLevel,
  formatPlaytomicLevel,
  PLAYTOMIC_LEVEL_MIN,
  PLAYTOMIC_LEVEL_MAX,
  DEFAULT_PLAYTOMIC_LEVEL,
} from '../lib/padelLevelUtils';

/**
 * Ét niveau-felt: træk slideren og læs beskrivelsen undervejs.
 * @param {number|null|undefined} value
 * @param {(n: number) => void} onChange
 */
export function PlaytomicLevelPicker({ value, onChange }) {
  const level = clampPlaytomicLevel(
    value != null && value !== '' && Number.isFinite(Number(value)) ? value : DEFAULT_PLAYTOMIC_LEVEL,
  );
  const bandTitle = levelBandTitleForNum(level);
  const desc = levelDescriptionForNum(level);

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
      <p style={{ fontSize: 12, color: theme.textLight, margin: '0 0 14px', lineHeight: 1.45 }}>
        Træk linjen og læs beskrivelsen — passer den til dig lige nu? Vær ærlig, så kampe bliver fair.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <input
          type="range"
          min={PLAYTOMIC_LEVEL_MIN}
          max={PLAYTOMIC_LEVEL_MAX}
          step={0.1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          onInput={(e) => setLevel(Number(e.target.value))}
          style={{ flex: 1, accentColor: theme.accent }}
          aria-valuetext={`Niveau ${formatPlaytomicLevel(level)}${bandTitle ? `, ${bandTitle}` : ''}`}
          aria-label="Træk for at vælge dit padel-niveau"
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
            color: theme.accent,
          }}
          aria-label="Niveau med ét decimal"
        />
      </div>

      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: '12px 14px',
        }}
        aria-live="polite"
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: theme.accent, lineHeight: 1 }}>
            {formatPlaytomicLevel(level)}
          </span>
          {bandTitle && (
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{bandTitle}</span>
          )}
        </div>
        {desc ? (
          <p style={{ fontSize: 13, color: theme.textMid, margin: 0, lineHeight: 1.55 }}>{desc}</p>
        ) : (
          <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>Træk slideren for at se beskrivelse.</p>
        )}
      </div>
    </div>
  );
}

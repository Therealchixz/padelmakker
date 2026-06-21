/**
 * Dual-thumb niveau-slider (Playtomic 1.0–5.0). Genbruges i opret-kamp og
 * opret-turnering. Mobil-venlig: store tcommit-targets, ingen hover-afhængighed.
 */
export function LevelRangeSlider({
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  min = 1.0,
  max = 5.0,
  step = 0.5,
}) {
  const toPercent = (v) => ((v - min) / (max - min)) * 100;

  return (
    <div style={{ padding: '20px 8px 4px' }}>
      <div style={{ position: 'relative', height: 32 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: 'var(--pm-border)', borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${toPercent(minVal)}%`, right: `${100 - toPercent(maxVal)}%`, height: 4, background: 'var(--pm-navy)', borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', top: -20, left: `${toPercent(minVal)}%`, transform: 'translateX(-50%)', background: 'var(--pm-navy)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 6 }}>
          {minVal.toFixed(1)}
        </div>
        <div style={{ position: 'absolute', top: -20, left: `${toPercent(maxVal)}%`, transform: 'translateX(-50%)', background: 'var(--pm-navy)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 6 }}>
          {maxVal.toFixed(1)}
        </div>

        <input
          type="range" min={min} max={max} step={step} value={minVal}
          onChange={(e) => { const v = parseFloat(e.target.value); if (v < maxVal) onMinChange(v); }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', zIndex: minVal > maxVal - step ? 5 : 4, margin: 0 }}
          className="pm-range-input"
          aria-label="Mindste niveau"
        />
        <input
          type="range" min={min} max={max} step={step} value={maxVal}
          onChange={(e) => { const v = parseFloat(e.target.value); if (v > minVal) onMaxChange(v); }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', zIndex: 4, margin: 0 }}
          className="pm-range-input"
          aria-label="Højeste niveau"
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 2px' }}>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} style={{ fontSize: 10, color: 'var(--pm-text-light)' }}>{l === 5 ? '5.0+' : `${l}.0`}</span>
        ))}
      </div>
    </div>
  );
}

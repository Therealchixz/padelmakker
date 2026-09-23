import { theme } from '../lib/platformTheme';

/**
 * Appens til/fra-kontakt (44x24, med 44x44 trykflade via pm-hit-44).
 * Bruges af aktiv søgning og indstillingerne for beskeder.
 */
export function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      className="pm-hit-44"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'wait' : 'pointer',
        background: checked ? theme.accent : theme.border,
        position: 'relative',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: theme.surface,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

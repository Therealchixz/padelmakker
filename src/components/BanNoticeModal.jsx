import { theme, btn } from '../lib/platformTheme';
import { AppModal } from './AppModal';

/**
 * Notice-modal vist når brugerens konto er banned.
 * Erstatter window.alert() — blokerer ikke event-loop og fungerer korrekt i PWA/iOS.
 */
export function BanNoticeModal({ reason, onAcknowledge }) {
  return (
    <AppModal
      open
      onClose={onAcknowledge}
      ariaLabel="Din konto er udelukket"
      maxWidthPreset="sm"
      zIndex={3000}
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <div className="pm-modal-body pm-modal-body--compact">
        <p id="pm-ban-title" style={{ fontSize: '16px', fontWeight: 700, color: theme.text, marginBottom: '10px' }}>
          Din konto er udelukket
        </p>
        <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.5, marginBottom: reason ? '12px' : '20px' }}>
          En administrator har udelukket din konto. Du bliver nu logget ud.
        </p>
        {reason && (
          <p
            style={{
              fontSize: '13px',
              color: theme.textMid,
              lineHeight: 1.5,
              marginBottom: '20px',
              padding: '10px 12px',
              background: theme.redBg,
              borderRadius: '8px',
              border: `1px solid ${theme.red}40`,
            }}
          >
            <strong style={{ color: theme.text }}>Begrundelse:</strong> {reason}
          </p>
        )}
        <button
          type="button"
          autoFocus
          onClick={onAcknowledge}
          style={{ ...btn(true), width: '100%', justifyContent: 'center' }}
        >
          OK, log ud
        </button>
      </div>
    </AppModal>
  );
}

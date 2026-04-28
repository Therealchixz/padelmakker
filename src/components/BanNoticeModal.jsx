import { theme, btn, font } from '../lib/platformTheme';

/**
 * Notice-modal vist når brugerens konto er banned.
 * Erstatter window.alert() — blokerer ikke event-loop og fungerer korrekt i PWA/iOS.
 */
export function BanNoticeModal({ reason, onAcknowledge }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-ban-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px',
        fontFamily: font,
      }}
    >
      <div
        style={{
          background: theme.surface,
          borderRadius: '14px',
          padding: '24px',
          maxWidth: '360px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid ' + theme.border,
        }}
      >
        <p id="pm-ban-title" style={{ fontSize: '16px', fontWeight: 700, color: theme.text, marginBottom: '10px' }}>
          Din konto er udelukket
        </p>
        <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.5, marginBottom: reason ? '12px' : '20px' }}>
          En administrator har udelukket din konto. Du bliver nu logget ud.
        </p>
        {reason && (
          <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5, marginBottom: '20px', padding: '10px 12px', background: theme.redBg, borderRadius: '8px', border: '1px solid ' + theme.red + '40' }}>
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
    </div>
  );
}

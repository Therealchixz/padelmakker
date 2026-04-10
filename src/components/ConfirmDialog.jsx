import { theme, btn } from '../lib/platformTheme';

/**
 * In-app bekræftelsesdialog — erstatter window.confirm().
 * Brug: <ConfirmDialog message="..." onConfirm={fn} onCancel={fn} />
 */
export function ConfirmDialog({ message, confirmLabel = 'Ja, fortsæt', cancelLabel = 'Fortryd', onConfirm, onCancel, danger = false }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '320px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '20px', lineHeight: 1.45 }}>{message}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ ...btn(false), flex: 1, justifyContent: 'center' }}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{ ...btn(true), flex: 1, justifyContent: 'center', ...(danger ? { background: theme.red, borderColor: theme.red } : {}) }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

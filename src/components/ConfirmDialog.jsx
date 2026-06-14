import { theme, btn } from '../lib/platformTheme';

export function ConfirmDialog({
  message,
  title,
  description,
  confirmLabel = 'Ja, fortsæt',
  cancelLabel = 'Fortryd',
  onConfirm,
  onCancel,
  danger = false,
  notice = false,
}) {
  const iconBg = danger ? theme.redBg || '#FEE2E2' : theme.amberBg || '#FFFBEB';
  const iconColor = danger ? theme.red || '#E5484D' : theme.amberText || '#92400E';
  const iconBorder = danger ? '#FCA5A5' : '#FCD34D';

  const hasStructuredContent = title || description;

  const DangerIcon = () => (
    <svg style={{ width: 24, height: 24 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/>
    </svg>
  );
  const InfoIcon = () => (
    <svg style={{ width: 24, height: 24 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
      onClick={notice ? undefined : onCancel}
    >
      <div
        style={{
          background: theme.surface, borderRadius: 16, padding: '24px 22px 20px',
          maxWidth: 320, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '1px solid ' + theme.border,
          textAlign: hasStructuredContent ? 'center' : 'left',
          fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {hasStructuredContent && (
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: iconBg, border: `1.5px solid ${iconBorder}`, color: iconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            {danger ? <DangerIcon /> : <InfoIcon />}
          </div>
        )}

        {hasStructuredContent ? (
          <>
            <div style={{ fontSize: '16.5px', fontWeight: 700, letterSpacing: '-0.2px', color: theme.text, marginBottom: 7 }}>
              {title || message}
            </div>
            {description && (
              <p style={{ fontSize: '12.5px', color: theme.textMid, lineHeight: 1.6, marginBottom: 4 }}>
                {description}
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '20px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: hasStructuredContent ? 16 : 0 }}>
          <button
            onClick={onConfirm}
            autoFocus={notice}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: 12, borderRadius: 10, border: 'none',
              background: danger ? theme.red || '#E5484D' : theme.accent || '#16377E',
              color: '#fff', fontSize: '14.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: danger ? 'none' : '0 6px 14px rgba(22,55,126,0.24)',
            }}
          >
            {notice ? (confirmLabel === 'Ja, fortsæt' ? 'OK' : confirmLabel) : confirmLabel}
          </button>
          {!notice && (
            <button
              onClick={onCancel}
              style={{
                width: '100%', padding: 11, borderRadius: 10,
                border: `1.5px solid ${theme.border}`, background: '#fff',
                color: theme.textMid, fontSize: '14.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

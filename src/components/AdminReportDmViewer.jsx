import { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { theme, btn } from '../lib/platformTheme';
import { fetchAdminDmThread } from '../lib/userModeration';

function formatMsgTime(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function AdminReportDmViewer({
  open,
  onClose,
  report,
  reporterName,
  reportedName,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !report?.reporter_id || !report?.reported_id) {
      setMessages([]);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminDmThread(report.reporter_id, report.reported_id)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setMessages([]);
          setError(err?.message || 'Kunne ikke hente samtalen');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, report?.reporter_id, report?.reported_id, report?.id]);

  if (!open || !report) return null;

  const reportAt = report.created_at ? new Date(report.created_at).getTime() : null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15,23,42,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dm-viewer-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          width: '100%',
          maxWidth: 520,
          maxHeight: 'min(85vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.shadowLg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div id="admin-dm-viewer-title" style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>
              <MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              DM-samtale
            </div>
            <div style={{ fontSize: 12, color: theme.textMid, marginTop: 4, lineHeight: 1.45 }}>
              {reporterName} (anmelder) ↔ {reportedName} (anmeldt)
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Luk" style={{ ...btn(false), padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            background: theme.bg,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', color: theme.textMid, fontSize: 13, padding: 24 }}>
              Indlæser beskeder…
            </div>
          )}
          {!loading && error && (
            <div style={{ fontSize: 13, color: theme.red, padding: 12, lineHeight: 1.45 }}>{error}</div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: theme.textMid, fontSize: 13, padding: 24 }}>
              Ingen beskeder mellem de to spillere.
            </div>
          )}
          {!loading &&
            !error &&
            messages.map((msg) => {
              const fromReporter = String(msg.sender_id) === String(report.reporter_id);
              const fromReported = String(msg.sender_id) === String(report.reported_id);
              const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : null;
              const nearReport =
                reportAt != null && msgTime != null && Math.abs(msgTime - reportAt) < 5 * 60 * 1000;

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: fromReporter ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: fromReported ? theme.red : theme.textMid,
                      marginBottom: 3,
                      textAlign: fromReporter ? 'left' : 'right',
                    }}
                  >
                    {fromReporter ? reporterName : reportedName}
                    {nearReport ? ' · omkring anmeldelse' : ''}
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: fromReported ? theme.redBg : theme.surface,
                      border: `1px solid ${fromReported ? 'var(--pm-danger-border, ' + theme.red + '40)' : theme.border}`,
                      color: theme.text,
                      boxShadow: nearReport ? `0 0 0 2px ${theme.warm}55` : 'none',
                    }}
                  >
                    {msg.content}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: theme.textLight,
                      marginTop: 3,
                      textAlign: fromReporter ? 'left' : 'right',
                    }}
                  >
                    {formatMsgTime(msg.created_at)}
                  </div>
                </div>
              );
            })}
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: `1px solid ${theme.border}`,
            fontSize: 11,
            color: theme.textMid,
            lineHeight: 1.45,
            flexShrink: 0,
          }}
        >
          Beskeder fra den anmeldte vises med rød markering. Ramme om beskeder sendt omkring anmeldelsestidspunktet.
          {!loading && messages.length > 0 && ` Viser ${messages.length} besked${messages.length === 1 ? '' : 'er'} (max. 300).`}
        </div>
      </div>
    </div>
  );
}

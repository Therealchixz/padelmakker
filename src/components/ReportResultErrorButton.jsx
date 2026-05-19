import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { theme, btn, inputStyle } from '../lib/platformTheme';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import {
  RESULT_ERROR_REASONS,
  fetchEntityCompletedAtMs,
  fetchMyResultErrorReport,
  isWithinResultErrorReportWindow,
  resultErrorReasonLabel,
  resultErrorReportDeadlineLabel,
  submitResultErrorReport,
} from '../lib/resultErrorReports';

const STATUS_LABELS = {
  open: 'Afventer admin',
  resolved: 'Løst af admin',
  dismissed: 'Afvist af admin',
};

export function ReportResultErrorButton({
  sourceType,
  entityId,
  completedAtMs,
  isCreator,
  entityLabel,
  onSubmitted,
}) {
  const ask = useConfirm();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('elo');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolvedCompletedMs, setResolvedCompletedMs] = useState(completedAtMs ?? null);

  useEffect(() => {
    setResolvedCompletedMs(completedAtMs ?? null);
  }, [completedAtMs]);

  useEffect(() => {
    if (!isCreator || !entityId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [row, serverMs] = await Promise.all([
          fetchMyResultErrorReport(sourceType, entityId),
          fetchEntityCompletedAtMs(sourceType, entityId),
        ]);
        if (!cancelled) {
          setReport(row);
          if (serverMs != null) setResolvedCompletedMs(serverMs);
        }
      } catch (e) {
        console.warn('result error report load:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType, entityId, isCreator]);

  if (!isCreator || loading) return null;

  const withinWindow = isWithinResultErrorReportWindow(resolvedCompletedMs);
  const deadlineLabel = withinWindow ? resultErrorReportDeadlineLabel(resolvedCompletedMs) : null;

  if (report) {
    return (
      <div
        className="pm-feedback-panel pm-feedback-panel--warning"
        style={{
          marginTop: 10,
          marginBottom: 4,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <AlertCircle size={14} aria-hidden />
        <span>
          Fejl indberettet ({STATUS_LABELS[report.status] || report.status})
          {report.reason ? ` · ${resultErrorReasonLabel(report.reason)}` : ''}
        </span>
      </div>
    );
  }

  if (!withinWindow) {
    return null;
  }

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await submitResultErrorReport({
        sourceType,
        entityId,
        reason,
        details,
      });
      setModalOpen(false);
      setDetails('');
      const row = await fetchMyResultErrorReport(sourceType, entityId);
      setReport(row);
      onSubmitted?.();
      await ask({
        message: 'Tak — admin har modtaget din indberetning og vil gennemgå den.',
        notice: true,
      });
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke sende indberetningen', notice: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ marginTop: 10, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            ...btn(false),
            width: '100%',
            justifyContent: 'center',
            fontSize: 12,
            padding: '8px 12px',
            color: theme.warm,
            borderColor: theme.warm + '66',
            background: theme.warmBg,
          }}
        >
          <AlertCircle size={14} aria-hidden />
          Indberet fejl
        </button>
        {deadlineLabel ? (
          <div style={{ fontSize: 11, color: theme.textLight, textAlign: 'center', marginTop: 6 }}>
            Frist: {deadlineLabel}
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          role="presentation"
          onClick={() => !busy && setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              padding: 20,
              width: '100%',
              maxWidth: 360,
              boxShadow: theme.shadowLg,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 4 }}>
              Indberet fejl
            </div>
            <p style={{ fontSize: 12, color: theme.textMid, marginBottom: 6, lineHeight: 1.45 }}>
              {entityLabel || 'Afsluttet aktivitet'}
            </p>
            <p style={{ fontSize: 12, color: theme.textMid, marginBottom: 14, lineHeight: 1.45 }}>
              Kun opretteren kan indberette. Admin modtager beskeden og kan rette ELO, point eller resultat.
              {deadlineLabel ? ` ${deadlineLabel}.` : ''}
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 6 }}>
              Fejltype
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12, fontSize: 14 }}
            >
              {RESULT_ERROR_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 6 }}>
              Beskrivelse (valgfrit)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Hvad er galt? F.eks. forkert score i runde 2…"
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 14, fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                style={{ ...btn(false), flex: 1, justifyContent: 'center' }}
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={() => { void handleSubmit(); }}
                disabled={busy}
                style={{ ...btn(true), flex: 1, justifyContent: 'center' }}
              >
                Send til admin
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

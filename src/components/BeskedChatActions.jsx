import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Flag, Ban, UserCheck } from 'lucide-react';
import { theme, btn, inputStyle } from '../lib/platformTheme';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import {
  REPORT_REASONS,
  blockUser,
  reportUser,
  unblockUser,
} from '../lib/userModeration';

export function BeskedChatActions({
  otherUserId,
  otherName,
  iBlockedThem,
  onBlocked,
  onUnblocked,
  onReported,
}) {
  const ask = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const handleBlock = async () => {
    setMenuOpen(false);
    const ok = await ask({
      message: `Bloker ${otherName}? Vedkommende kan ikke længere sende dig beskeder, og I kan ikke skrive til hinanden i chatten.`,
      confirmLabel: 'Bloker',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await blockUser(otherUserId);
      await ask({
        message: `${otherName} er blokeret. Du kan fjerne blokeringen senere fra samme menu.`,
        notice: true,
      });
      onBlocked?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke blokere brugeren', notice: true });
    } finally {
      setBusy(false);
    }
  };

  const handleUnblock = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      await unblockUser(otherUserId);
      await ask({ message: `${otherName} er ikke længere blokeret.`, notice: true });
      onUnblocked?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke fjerne blokering', notice: true });
    } finally {
      setBusy(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      await ask({ message: 'Vælg en årsag til anmeldelsen.', notice: true });
      return;
    }
    setBusy(true);
    try {
      await reportUser({
        reportedId: otherUserId,
        reason: reportReason,
        details: reportDetails,
        context: 'dm',
      });
      setReportOpen(false);
      setReportDetails('');
      await ask({
        message: 'Tak — admin har modtaget din anmeldelse og vil gennemgå den.',
        notice: true,
      });
      onReported?.();
    } catch (e) {
      await ask({ message: e?.message || 'Kunne ikke sende anmeldelsen', notice: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={busy}
          aria-label="Chat-indstillinger"
          aria-expanded={menuOpen}
          style={{
            ...btn(false),
            padding: '6px 8px',
            minHeight: '34px',
          }}
        >
          <MoreVertical size={18} />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Luk menu"
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 40,
                border: 'none',
                background: 'transparent',
                cursor: 'default',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                zIndex: 41,
                minWidth: 200,
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                boxShadow: theme.shadowLg,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '11px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                  textAlign: 'left',
                }}
              >
                <Flag size={15} color={theme.warm} />
                Anmeld til admin
              </button>
              {iBlockedThem ? (
                <button
                  type="button"
                  onClick={handleUnblock}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '11px 14px',
                    border: 'none',
                    borderTop: `1px solid ${theme.border}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.text,
                    textAlign: 'left',
                  }}
                >
                  <UserCheck size={15} color={theme.textMid} />
                  Fjern blokering
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBlock}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '11px 14px',
                    border: 'none',
                    borderTop: `1px solid ${theme.border}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.red,
                    textAlign: 'left',
                  }}
                >
                  <Ban size={15} />
                  Bloker bruger
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {reportOpen ? createPortal((
        <div
          role="presentation"
          onClick={() => !busy && setReportOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483600,
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
              Anmeld {otherName}
            </div>
            <p style={{ fontSize: 12, color: theme.textMid, marginBottom: 14, lineHeight: 1.45 }}>
              Admin modtager din anmeldelse. Misbrug af anmeldelse kan medføre sanktioner.
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 6 }}>
              Årsag
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12, fontSize: 14 }}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textLight, marginBottom: 6 }}>
              Detaljer (valgfrit)
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Kort beskrivelse af hvad der skete…"
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 14, fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={busy}
                style={{ ...btn(false), flex: 1, justifyContent: 'center' }}
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={handleReportSubmit}
                disabled={busy}
                style={{ ...btn(true), flex: 1, justifyContent: 'center' }}
              >
                Send anmeldelse
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </>
  );
}

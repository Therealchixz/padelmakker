import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppModal } from './AppModal';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import {
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_DEFAULT_CATEGORY,
  FEEDBACK_DEFAULT_PRIORITY,
  FEEDBACK_PRIORITY_OPTIONS,
} from '../lib/uiConstants';
import { submitFeedbackReport } from '../lib/submitFeedbackReport';
import { cn } from '../lib/utils';

export function FeedbackReportModal({
  open,
  onClose,
  showToast,
  displayName,
  userId,
  userEmail,
}) {
  const ask = useConfirm();
  const location = useLocation();
  const [category, setCategory] = useState(FEEDBACK_DEFAULT_CATEGORY);
  const [priority, setPriority] = useState(FEEDBACK_DEFAULT_PRIORITY);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const resetForm = useCallback(() => {
    setCategory(FEEDBACK_DEFAULT_CATEGORY);
    setPriority(FEEDBACK_DEFAULT_PRIORITY);
    setTopic('');
    setMessage('');
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  const messageTrimmed = message.trim();
  const messageValid = messageTrimmed.length >= 10;

  const handleClose = useCallback(async () => {
    if (sending) return;
    const hasDraft = topic.trim().length > 0 || messageTrimmed.length > 0;
    if (hasDraft) {
      const confirmed = await ask({
        message: 'Du har tekst du ikke har sendt. Vil du lukke?',
        confirmLabel: 'Ja, luk',
        cancelLabel: 'Bliv her',
        danger: true,
      });
      if (!confirmed) return;
    }
    resetForm();
    onClose();
  }, [ask, messageTrimmed, onClose, resetForm, sending, topic]);

  const handleSubmit = useCallback(async () => {
    if (!messageValid) {
      showToast?.('Skriv gerne mindst 10 tegn, så vi kan hjælpe bedre.');
      return;
    }

    setSending(true);
    try {
      await submitFeedbackReport({
        category,
        priority,
        topic: topic.trim() || null,
        message: messageTrimmed,
        displayName,
        userId,
        userEmail,
        routePath: location.pathname + location.search,
        pageUrl: typeof window !== 'undefined' ? window.location.href : null,
      });
      resetForm();
      onClose();
      showToast?.('Tak! Din indberetning er sendt.');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Kunne ikke sende indberetningen.';
      showToast?.(messageText);
    } finally {
      setSending(false);
    }
  }, [
    category,
    displayName,
    location.pathname,
    location.search,
    messageTrimmed,
    messageValid,
    onClose,
    priority,
    resetForm,
    showToast,
    topic,
    userEmail,
    userId,
  ]);

  return (
    <AppModal
      open={open}
      onClose={() => { void handleClose(); }}
      ariaLabel="Rapportér fejl"
      maxWidth="560px"
      zIndex={10020}
    >
      <div className="overflow-hidden rounded-[14px]">
        <div className="border-b border-pm-border px-4 py-3.5">
          <h2 className="text-lg font-extrabold text-pm-text">Rapportér fejl</h2>
          <p className="mt-1 text-xs text-pm-text-mid">
            Beskriv bug eller problem — vi sender den direkte til kontakt@padelmakker.dk.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-pm-text-mid">Kategori</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={sending}
                className="w-full rounded-[10px] border border-pm-border bg-pm-surface px-3 py-2.5 text-base md:text-sm text-pm-text outline-none"
              >
                {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-pm-text-mid">Prioritet</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                disabled={sending}
                className="w-full rounded-[10px] border border-pm-border bg-pm-surface px-3 py-2.5 text-base md:text-sm text-pm-text outline-none"
              >
                {FEEDBACK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-pm-text-mid">Emne</span>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value.slice(0, 120))}
              placeholder="Kort titel (valgfri)"
              disabled={sending}
              className="w-full rounded-[10px] border border-pm-border bg-pm-surface px-3 py-2.5 text-base md:text-sm text-pm-text outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-pm-text-mid">
              Beskrivelse <span className="font-medium text-pm-text-light">(mindst 10 tegn)</span>
            </span>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 3000))}
              placeholder="Fx: På Kampe-tabben får jeg fejl når jeg trykker Gem resultat efter en 2v2-kamp…"
              disabled={sending}
              rows={6}
              className={cn(
                'w-full resize-y rounded-[10px] border bg-pm-surface px-3 py-2.5 text-base md:text-sm text-pm-text outline-none',
                messageValid ? 'border-pm-border' : 'border-amber-400',
              )}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-pm-border px-4 py-3">
          <button
            type="button"
            onClick={() => { void handleClose(); }}
            disabled={sending}
            className="rounded-[9px] border border-pm-border bg-pm-surface px-3 py-2 text-xs font-bold text-pm-text-mid"
          >
            Annuller
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={sending || !messageValid}
            title={!messageValid ? 'Skriv mindst 10 tegn i beskrivelsen' : undefined}
            className={cn(
              'rounded-[9px] bg-pm-accent px-3 py-2 text-xs font-extrabold text-white',
              (sending || !messageValid) && 'cursor-not-allowed opacity-60',
            )}
          >
            {sending
              ? 'Sender...'
              : !messageValid
                ? `Mangler ${10 - messageTrimmed.length} tegn`
                : 'Send indberetning'}
          </button>
        </div>
      </div>
    </AppModal>
  );
}

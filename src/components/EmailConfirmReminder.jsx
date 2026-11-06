import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle } from '../lib/platformTheme';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { emailAwaitingConfirmation } from '../lib/phoneVerification';
import { isValidSignupEmail } from '../lib/validationHelpers';

const DISMISS_KEY = 'pm_email_confirm_reminder_dismissed_v1';

/**
 * Nye brugere kommer ind i appen lige efter SMS-koden. E-mailen bekræftes senere;
 * denne lille påmindelse står på Hjem og Profil, indtil linket er klikket.
 * Man skriver kun sin e-mail én gang ved oprettelsen, så en tastefejl skal kunne rettes her.
 */
export function EmailConfirmReminder({ user }) {
  const pending = emailAwaitingConfirmation(user);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');

  if (!pending || dismissed) return null;

  const resend = async () => {
    setSending(true);
    setStatus('');
    try {
      const { error } = await supabase.auth.resend({ type: 'email_change', email: pending });
      if (error) throw error;
      setStatus(`Nyt link sendt til ${pending}. Husk at kigge i spam.`);
    } catch (e) {
      setStatus(mapAuthErrorMessage(e?.message, 'forgot'));
    } finally {
      setSending(false);
    }
  };

  const startEdit = () => {
    setDraft(pending);
    setDraftError('');
    setStatus('');
    setEditing(true);
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    const next = draft.trim();
    if (!isValidSignupEmail(next)) {
      setDraftError('Brug en gyldig e-mail med @ og domæne (fx navn@mail.dk).');
      return;
    }
    if (next.toLowerCase() === pending.toLowerCase()) {
      setEditing(false);
      return;
    }
    setSending(true);
    setDraftError('');
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      setEditing(false);
      setStatus(`E-mail rettet. Nyt link sendt til ${next}. Husk at kigge i spam.`);
    } catch (err) {
      const raw = String(err?.message || '').toLowerCase();
      setDraftError(
        raw.includes('already') || raw.includes('email_exists')
          ? 'Den e-mail er allerede i brug på en anden konto.'
          : 'Kunne ikke gemme den nye e-mail. Prøv igen om lidt.',
      );
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <section
      aria-labelledby="pm-email-reminder-title"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '0 0 16px',
      }}
    >
      <MailCheck size={20} color={theme.textMid} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 id="pm-email-reminder-title" style={{ fontSize: '15px', fontWeight: 700, color: theme.text, margin: 0 }}>
          Bekræft din e-mail
        </h2>
        <p style={{ fontSize: '14px', color: theme.textMid, margin: '4px 0 0', lineHeight: 1.5 }}>
          Vi har sendt et link til <strong style={{ color: theme.text }}>{pending}</strong>. Klik på det, så kan du også logge ind
          med e-mail og nulstille din adgangskode, hvis du glemmer den.
        </p>
        {status && (
          <p role="status" style={{ fontSize: '13px', color: theme.green, fontWeight: 600, margin: '8px 0 0' }}>{status}</p>
        )}
        {editing ? (
          <form onSubmit={(e) => { void saveEmail(e); }} style={{ marginTop: '10px' }}>
            <label htmlFor="pm-email-reminder-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
              Din rigtige e-mail
            </label>
            <input
              id="pm-email-reminder-input"
              type="email"
              autoComplete="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={draftError ? true : undefined}
              aria-describedby={draftError ? 'pm-email-reminder-error' : undefined}
              style={{ ...inputStyle, maxWidth: '360px' }}
            />
            {draftError && (
              <p id="pm-email-reminder-error" role="alert" style={{ fontSize: '13px', color: theme.red, fontWeight: 600, margin: '6px 0 0' }}>{draftError}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              <button type="submit" disabled={sending} style={{ ...btn(true), fontSize: '13px', padding: '8px 14px' }}>
                {sending ? 'Gemmer…' : 'Gem og send link'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ border: 'none', background: 'transparent', color: theme.textMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', minHeight: '44px', padding: '0 8px' }}
              >
                Annuller
              </button>
            </div>
          </form>
        ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          <button type="button" onClick={() => { void resend(); }} disabled={sending} style={{ ...btn(false), fontSize: '13px', padding: '8px 14px' }}>
            {sending ? 'Sender…' : 'Send linket igen'}
          </button>
          <button
            type="button"
            onClick={startEdit}
            style={{ border: 'none', background: 'transparent', color: theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', minHeight: '44px', padding: '0 8px' }}
          >
            Forkert e-mail? Ret den
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{ border: 'none', background: 'transparent', color: theme.textMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', minHeight: '44px', padding: '0 8px' }}
          >
            Senere
          </button>
        </div>
        )}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { theme, btn } from '../lib/platformTheme';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { emailAwaitingConfirmation } from '../lib/phoneVerification';

const DISMISS_KEY = 'pm_email_confirm_reminder_dismissed_v1';

/**
 * Nye brugere kommer ind i appen lige efter SMS-koden. E-mailen bekræftes senere;
 * denne lille påmindelse står på Hjem og Profil, indtil linket er klikket.
 */
export function EmailConfirmReminder({ user }) {
  const pending = emailAwaitingConfirmation(user);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

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
      <MailCheck size={20} color={theme.accent} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 id="pm-email-reminder-title" style={{ fontSize: '15px', fontWeight: 700, color: theme.text, margin: 0 }}>
          Bekræft din e-mail
        </h2>
        <p style={{ fontSize: '14px', color: theme.textMid, margin: '4px 0 0', lineHeight: 1.5 }}>
          Vi har sendt et link til <strong style={{ color: theme.text }}>{pending}</strong>. Klik på det, så kan du også logge ind
          med e-mail og nulstille din adgangskode, hvis du glemmer den.
        </p>
        {status && (
          <p role="status" style={{ fontSize: '13px', color: theme.accent, fontWeight: 600, margin: '8px 0 0' }}>{status}</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          <button type="button" onClick={() => { void resend(); }} disabled={sending} style={{ ...btn(false), fontSize: '13px', padding: '8px 14px' }}>
            {sending ? 'Sender…' : 'Send linket igen'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{ border: 'none', background: 'transparent', color: theme.textMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', minHeight: '44px', padding: '0 8px' }}
          >
            Senere
          </button>
        </div>
      </div>
    </section>
  );
}

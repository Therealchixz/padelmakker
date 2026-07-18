import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { font, theme, btn } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { useAuth } from '../lib/AuthContext';
import { shouldRequireEmailVerification } from '../lib/phoneVerification';
import { supabase } from '../lib/supabase';
import {
  clearPendingSignupEmail,
  readPendingSignupEmail,
  writePendingSignupEmail,
} from '../lib/signupEmailPending';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { mapUserFacingError } from '../lib/userFacingErrors';

const RESEND_COOLDOWN_MS = 60_000;

export function SignupEmailSentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const pending = readPendingSignupEmail();
  const stateEmail = typeof location.state?.email === 'string' ? location.state.email.trim() : '';
  const statePhone = typeof location.state?.phone === 'string' ? location.state.phone.trim() : '';
  const authEmail = user?.email ? String(user.email).trim() : '';
  const email = (
    stateEmail
    || pending?.email
    || (user && shouldRequireEmailVerification(user) ? authEmail : '')
  ).trim();
  const phone = statePhone || pending?.phone || '';

  const [resendAtMs, setResendAtMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [resendBusy, setResendBusy] = useState(false);
  const [resendInfo, setResendInfo] = useState('');
  const [resendErr, setResendErr] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/opret', { replace: true });
      return;
    }
    writePendingSignupEmail({ email, phone: phone || undefined });
  }, [email, phone, navigate]);

  useEffect(() => {
    if (user?.email_confirmed_at) {
      clearPendingSignupEmail();
    }
  }, [user?.email_confirmed_at]);

  useEffect(() => {
    if (resendAtMs <= Date.now()) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [resendAtMs]);

  if (!email) {
    return null;
  }

  const resendSeconds = Math.max(0, Math.ceil((resendAtMs - nowMs) / 1000));
  const canResend = resendSeconds <= 0 && !resendBusy;

  const handleResend = async () => {
    if (!canResend) return;
    setResendBusy(true);
    setResendErr('');
    setResendInfo('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setResendAtMs(Date.now() + RESEND_COOLDOWN_MS);
      setNowMs(Date.now());
      setResendInfo('Ny bekræftelsesmail er sendt. Tjek indbakke og spam.');
    } catch (e) {
      const raw = String(e?.message || '');
      const authMapped = mapAuthErrorMessage(raw, 'forgot');
      setResendErr(
        authMapped !== raw
          ? authMapped
          : mapUserFacingError(e, 'Kunne ikke sende e-mail igen. Prøv igen om lidt.'),
      );
    } finally {
      setResendBusy(false);
    }
  };

  const steps = [
    'Åbn den e-mail, vi har sendt dig',
    'Klik på bekræftelseslinket',
    'Åbn helst linket i samme browser som du oprettede profilen i',
    'Når e-mailen er bekræftet, kan du logge ind',
    phone
      ? `Dit telefonnummer (${phone}) er allerede bekræftet med SMS`
      : 'Dit telefonnummer er bekræftet med SMS',
  ];

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        padding: 'max(60px, env(safe-area-inset-top)) 20px max(96px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <div className="pm-auth-panel pm-auth-panel--centered pm-auth-panel--stack">
        <div className="pm-auth-check-icon" aria-hidden>
          <Check size={30} strokeWidth={2.5} />
        </div>

        <p style={{ fontSize: '12px', fontWeight: 700, color: theme.accent, margin: '0 0 10px', letterSpacing: '0.04em' }}>
          Trin 3 af 3 · Bekræft email
        </p>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            lineHeight: 1.2,
            color: theme.text,
          }}
        >
          Tjek din e-mail
        </h1>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.55,
            color: theme.textMid,
            margin: '0 0 24px',
          }}
        >
          Vi har sendt et bekræftelseslink til{' '}
          <strong style={{ color: theme.text, fontWeight: 600 }}>{email}</strong>
        </p>

        <div
          style={{
            background: theme.accentBg,
            borderRadius: '10px',
            padding: '16px 18px',
            textAlign: 'left',
            border: '1px solid ' + theme.accent + '30',
            marginBottom: '20px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: theme.accent,
              margin: '0 0 10px',
            }}
          >
            For at fuldføre din oprettelse:
          </p>
          <ol
            style={{
              margin: 0,
              paddingLeft: '20px',
              color: theme.textMid,
              fontSize: '13px',
              lineHeight: 1.65,
            }}
          >
            {steps.map((line) => (
              <li key={line} style={{ marginBottom: '5px' }}>
                {line}
              </li>
            ))}
          </ol>
        </div>

        <p style={{ fontSize: '13px', color: theme.textLight, margin: '0 0 8px', lineHeight: 1.5 }}>
          Bekræftelseslinket udløber om 24 timer. Du kan genåbne denne side senere — vi husker din e-mail i denne browser.
        </p>

        <p style={{ fontSize: '13px', color: theme.textLight, margin: '0 0 16px', lineHeight: 1.5 }}>
          Modtog du ikke e-mailen? Tjek spam, og send den igen herunder.
        </p>

        {resendInfo ? (
          <p role="status" style={{ fontSize: '13px', color: theme.accent, margin: '0 0 12px', fontWeight: 600 }}>
            {resendInfo}
          </p>
        ) : null}
        {resendErr ? (
          <p role="alert" style={{ fontSize: '13px', color: theme.red, margin: '0 0 12px', fontWeight: 600 }}>
            {resendErr}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={!canResend}
          style={{
            ...btn(false),
            width: '100%',
            justifyContent: 'center',
            marginBottom: '12px',
            opacity: canResend ? 1 : 0.65,
            cursor: canResend ? 'pointer' : 'default',
          }}
        >
          {resendBusy ? 'Sender…' : canResend ? 'Send bekræftelsesmail igen' : `Send igen om ${resendSeconds}s`}
        </button>

        <Link
          to="/login"
          replace
          style={{
            ...btn(true),
            width: '100%',
            justifyContent: 'center',
            padding: '12px 20px',
            textDecoration: 'none',
            display: 'flex',
          }}
        >
          Gå til login
        </Link>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          marginTop: '24px',
        }}
      >
        <PublicLegalFooter />
      </div>
    </div>
  );
}

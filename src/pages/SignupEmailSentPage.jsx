import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { font, theme, btn } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';

export function SignupEmailSentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = typeof location.state?.email === 'string' ? location.state.email.trim() : '';
  const phone = typeof location.state?.phone === 'string' ? location.state.phone.trim() : '';

  useEffect(() => {
    if (!email) {
      navigate('/opret', { replace: true });
    }
  }, [email, navigate]);

  if (!email) {
    return null;
  }

  const steps = [
    'Åbn den e-mail, vi lige har sendt dig',
    'Klik på bekræftelseslinket',
    'Åbn helst linket i samme browser som du oprettede profilen i',
    'Når profilen er bekræftet, kan du logge ind',
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
          Bekræftelseslinket udløber om 24 timer.
        </p>

        <p style={{ fontSize: '13px', color: theme.textLight, margin: '0 0 24px', lineHeight: 1.5 }}>
          Modtog du ikke e-mailen? Tjek din spam-mappe, og prøv derefter at logge ind når linket er bekræftet.
        </p>

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

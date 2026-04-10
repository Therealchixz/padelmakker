import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';

export function SignupEmailSentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = typeof location.state?.email === 'string' ? location.state.email.trim() : '';

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
    'Du vil kunne logge ind, når du er blevet bekræftet',
  ];

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="pm-auth-narrow">
        <button
          type="button"
          onClick={() => navigate('/opret', { replace: true })}
          style={{ ...btn(false), marginBottom: '40px', padding: '8px 14px', fontSize: '13px' }}
        >
          ← Tilbage til oprettelse
        </button>

        <div
          style={{
            background: theme.surface,
            borderRadius: theme.radius,
            padding: '28px 22px 26px',
            boxShadow: theme.shadowLg,
            border: `1px solid ${theme.border}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 20px rgba(34, 197, 94, 0.28)',
            }}
            aria-hidden
          >
            <Check size={30} strokeWidth={2.5} color="#fff" />
          </div>

          <h1 style={{ ...heading('26px'), marginBottom: '10px' }}>Tjek din e-mail</h1>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.55,
              color: theme.textMid,
              margin: '0 0 22px',
            }}
          >
            Vi har sendt et bekræftelseslink til{' '}
            <strong style={{ color: theme.text, fontWeight: 600 }}>{email}</strong>
          </p>

          <div
            style={{
              background: theme.accentBg,
              borderRadius: theme.radius,
              padding: '16px 16px 14px',
              textAlign: 'left',
              border: `1px solid ${theme.border}`,
              marginBottom: '14px',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.text,
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
                fontSize: '14px',
                lineHeight: 1.65,
              }}
            >
              {steps.map((line) => (
                <li key={line} style={{ marginBottom: '6px' }}>
                  {line}
                </li>
              ))}
            </ol>
          </div>

          <p style={{ fontSize: '13px', color: theme.textMid, margin: '0 0 12px', lineHeight: 1.5 }}>
            Bekræftelseslinket udløber om 24 timer.
          </p>

          <p style={{ fontSize: '13px', color: theme.textMid, margin: '0 0 22px', lineHeight: 1.5 }}>
            Modtog du ikke e-mailen? Tjek din spam-mappe.
          </p>

          <Link
            to="/login"
            replace
            style={{ ...btn(true), width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex' }}
          >
            Gå til login
          </Link>
        </div>

        <PublicLegalFooter />
      </div>
    </div>
  );
}

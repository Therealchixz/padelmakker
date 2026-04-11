import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { font, btn } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';

const pageBg = '#0B0F14';
const cardBg = '#151B24';
const insetBg = '#0E131A';
const textMuted = '#94A3B8';

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
        background: pageBg,
        minHeight: '100dvh',
        color: '#F8FAFC',
        padding: 'max(60px, env(safe-area-inset-top)) 20px max(96px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: cardBg,
          borderRadius: '16px',
          padding: '40px 36px 36px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
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
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.35)',
          }}
          aria-hidden
        >
          <Check size={30} strokeWidth={2.5} color="#fff" />
        </div>

        <h1
          style={{
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            lineHeight: 1.2,
            color: '#F8FAFC',
          }}
        >
          Tjek din e-mail
        </h1>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.55,
            color: textMuted,
            margin: '0 0 24px',
          }}
        >
          Vi har sendt et bekræftelseslink til{' '}
          <strong style={{ color: '#F8FAFC', fontWeight: 600 }}>{email}</strong>
        </p>

        <div
          style={{
            background: insetBg,
            borderRadius: '12px',
            padding: '18px 18px 16px',
            textAlign: 'left',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#E2E8F0',
              margin: '0 0 12px',
            }}
          >
            For at fuldføre din oprettelse:
          </p>
          <ol
            style={{
              margin: 0,
              paddingLeft: '20px',
              color: textMuted,
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

        <p style={{ fontSize: '13px', color: textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>
          Bekræftelseslinket udløber om 24 timer.
        </p>

        <p style={{ fontSize: '13px', color: textMuted, margin: '0 0 24px', lineHeight: 1.5 }}>
          Modtog du ikke e-mailen? Tjek din spam-mappe.
        </p>

        <Link
          to="/login"
          replace
          style={{
            ...btn(false),
            width: '100%',
            justifyContent: 'center',
            marginTop: '8px',
            padding: '12px 20px',
            background: 'transparent',
            color: '#F8FAFC',
            border: '1px solid rgba(248, 250, 252, 0.22)',
            boxShadow: 'none',
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
          maxWidth: '560px',
          marginTop: '28px',
        }}
      >
        <PublicLegalFooter tone="dark" />
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { font, btn } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';

/**
 * Eksplicit lyst layout (Tailwind + PM-farver) + color-scheme: light
 * så OS/browser dark mode ikke gør siden mørk.
 */
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
      className="pm-root min-h-[100dvh] [color-scheme:light] bg-[#F0F4F8] text-[#0B1120]"
      style={{ fontFamily: font, paddingBottom: 'max(96px, env(safe-area-inset-bottom))' }}
    >
      <div className="pm-auth-narrow">
        <button
          type="button"
          onClick={() => navigate('/opret', { replace: true })}
          className="mb-10 rounded-lg border border-[#D5DDE8] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0B1120] shadow-sm transition hover:bg-[#F8FAFC]"
        >
          ← Tilbage til oprettelse
        </button>

        <div className="rounded-[12px] border border-[#D5DDE8] bg-white px-6 py-7 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)] sm:px-7">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#22C55E] shadow-[0_8px_20px_rgba(34,197,94,0.28)]"
            aria-hidden
          >
            <Check size={30} strokeWidth={2.5} color="#fff" />
          </div>

          <h1 className="mb-2.5 text-[26px] font-extrabold tracking-[-0.03em] text-[#0B1120]">
            Tjek din e-mail
          </h1>

          <p className="mb-5 text-[15px] leading-relaxed text-[#3E4C63]">
            Vi har sendt et bekræftelseslink til <strong className="font-semibold text-[#0B1120]">{email}</strong>
          </p>

          <div className="mb-3.5 rounded-[12px] border border-[#D5DDE8] bg-[#DBEAFE] px-4 py-4 text-left">
            <p className="mb-2.5 text-[13px] font-semibold text-[#0B1120]">For at fuldføre din oprettelse:</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#3E4C63]">
              {steps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>

          <p className="mb-3 text-[13px] leading-normal text-[#3E4C63]">
            Bekræftelseslinket udløber om 24 timer.
          </p>

          <p className="mb-5 text-[13px] leading-normal text-[#3E4C63]">
            Modtog du ikke e-mailen? Tjek din spam-mappe.
          </p>

          <Link
            to="/login"
            replace
            className="flex w-full items-center justify-center rounded-lg text-[14px] font-semibold no-underline"
            style={{ ...btn(true) }}
          >
            Gå til login
          </Link>
        </div>

        <PublicLegalFooter />
      </div>
    </div>
  );
}

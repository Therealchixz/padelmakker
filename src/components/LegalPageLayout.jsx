import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme } from '../lib/platformTheme';
import { LEGAL_INFO } from '../lib/legalInfo';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicSiteFooter } from './PublicSiteFooter';
import '../styles/public-site.css';

/**
 * Offentlige undersider: forsiden fortsat paa papir (faelles top og bund, stor Anton-titel,
 * ingen kasse om indholdet). Farver og skrifter er de samme som foer.
 * @param {{
 *   title: string;
 *   children: import('react').ReactNode;
 *   showUpdated?: boolean;   // "Senest opdateret" giver kun mening paa juridiske sider
 *   showSignupCta?: boolean; // "Opret gratis profil" nederst for besoegende, der ikke er logget ind
 * }} props
 */
export function LegalPageLayout({ title, children, showUpdated = true, showSignupCta = false }) {
  const navigate = useNavigate();
  const { session } = useAuth();

  return (
    <div
      className="pm-legal-page pm-brand pm-pub"
      style={{ fontFamily: font, background: theme.bg, minHeight: '100dvh', color: theme.text }}
    >
      <PublicSiteHeader />
      <main className="pm-pub-inner pm-pub-main">
        <h1 className="pm-pub-h1">{title}</h1>
        {showUpdated ? <p className="pm-pub-updated">Senest opdateret: {LEGAL_INFO.lastUpdated}</p> : null}
        <div className="pm-legal-prose pm-pub-prose">{children}</div>
        {showSignupCta && !session ? (
          <div className="pm-pub-cta">
            <p>Klar til at finde din næste makker?</p>
            <button type="button" className="pm-pub-btn pm-pub-btn--solid" onClick={() => navigate('/opret')}>
              Opret gratis profil
            </button>
          </div>
        ) : null}
      </main>
      <PublicSiteFooter />
    </div>
  );
}

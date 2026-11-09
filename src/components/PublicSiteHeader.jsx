import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useDarkMode } from '../lib/useDarkMode';

/** Faelles top for de offentlige undersider (samme punkter som forsidens menu). */
export function PublicSiteHeader() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [dark] = useDarkMode();
  return (
    <header className="pm-pub-header">
      <div className="pm-pub-inner pm-pub-header-row">
        <Link to="/" className="pm-pub-logo" aria-label="PadelMakker forsiden">
          <picture>
            <source srcSet={dark ? '/logo-brand-dark-nav.webp' : '/logo-brand-nav.webp'} type="image/webp" />
            <img src={dark ? '/logo-brand-dark.png' : '/logo-brand.png'} width={320} height={120} alt="PadelMakker" />
          </picture>
        </Link>
        <nav className="pm-pub-nav" aria-label="Hovedmenu">
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/hjaelp">Hjælp</NavLink>
        </nav>
        <div className="pm-pub-actions">
          {session ? (
            <button type="button" className="pm-pub-btn pm-pub-btn--solid" onClick={() => navigate('/dashboard/hjem')}>
              Gå til appen
            </button>
          ) : (
            <>
              <button type="button" className="pm-pub-btn" onClick={() => navigate('/login')}>Log ind</button>
              <button type="button" className="pm-pub-btn pm-pub-btn--solid pm-pub-signup" onClick={() => navigate('/opret')}>
                Opret profil
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

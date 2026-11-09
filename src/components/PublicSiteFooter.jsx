import { Link } from 'react-router-dom';
import { LEGAL_INFO } from '../lib/legalInfo';

/** Faelles bund for de offentlige undersider (samme opbygning som forsidens: Kontakt og Udforsk). */
export function PublicSiteFooter() {
  return (
    <footer className="pm-pub-footer">
      <div className="pm-pub-inner">
        <div className="pm-pub-footer-cols">
          <div>
            <h2>Kontakt</h2>
            <ul>
              <li><a href={`mailto:${LEGAL_INFO.email}`}>{LEGAL_INFO.email}</a></li>
              <li><Link to="/hjaelp">Hjælp og kontakt</Link></li>
              <li><Link to="/app">Installér app</Link></li>
            </ul>
          </div>
          <div>
            <h2>Udforsk</h2>
            <ul>
              <li><Link to="/om">Om PadelMakker</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/events">Events</Link></li>
              <li><Link to="/elo">Sådan virker ELO</Link></li>
            </ul>
          </div>
        </div>
        <div className="pm-pub-footer-base">
          <span className="pm-pub-mono">© 2026 PadelMakker · CVR {LEGAL_INFO.cvr}</span>
          <nav aria-label="Juridisk">
            <Link to="/privatlivspolitik">Privatlivspolitik</Link>
            <Link to="/handelsbetingelser">Handelsbetingelser</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import { LEGAL_INFO } from '../lib/legalInfo';
import { theme } from '../lib/platformTheme';

/* Ingen '·'-skilletegn: på mobil endte de alene forrest på en linje (QA 14. okt. 2026). Afstanden (gap) skiller linkene. */
/** @param {{ tone?: 'light' | 'dark' }} [props] */
export function PublicLegalFooter({ tone = 'light' } = {}) {
  const dark = tone === 'dark'
  const linkColor = dark ? theme.infoBorder : theme.accent
  const muted = theme.textLight
  const sep = dark ? 'rgba(148, 163, 184, 0.35)' : theme.border
  const linkStyle = { color: linkColor, fontSize: '13px', fontWeight: 500, textDecoration: 'none' }
  return (
    <footer
      className="pm-public-legal-footer"
      style={{
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: `1px solid ${sep}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 20px',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '13px',
        color: muted,
      }}
    >
      <span style={{ color: muted }}>
        {LEGAL_INFO.legalName} · CVR-nr. {LEGAL_INFO.cvr}
      </span>
      <Link to="/privatlivspolitik" style={linkStyle}>
        Privatlivspolitik
      </Link>
      <Link to="/handelsbetingelser" style={linkStyle}>
        Handelsbetingelser
      </Link>
      <Link to="/cookies" style={linkStyle}>
        Cookies
      </Link>
      <Link to="/om" style={linkStyle}>
        Om PadelMakker
      </Link>
      <Link to="/faq" style={linkStyle}>
        FAQ
      </Link>
      <Link to="/elo" style={linkStyle}>
        ELO
      </Link>
      <Link to="/events" style={linkStyle}>
        Events
      </Link>
      <Link to="/hjaelp" style={linkStyle}>
        Hjælp
      </Link>
      <Link to="/app" style={linkStyle}>
        Installér app
      </Link>
    </footer>
  );
}

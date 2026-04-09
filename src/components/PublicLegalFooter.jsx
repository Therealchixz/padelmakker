import { Link } from 'react-router-dom';
import { theme } from '../lib/platformTheme';

const linkStyle = {
  color: theme.accent,
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
};

export function PublicLegalFooter() {
  return (
    <footer
      className="pm-public-legal-footer"
      style={{
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 20px',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '13px',
        color: theme.textLight,
      }}
    >
      <Link to="/privatlivspolitik" style={linkStyle}>
        Privatlivspolitik
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/handelsbetingelser" style={linkStyle}>
        Handelsbetingelser
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/cookies" style={linkStyle}>
        Cookies
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/om" style={linkStyle}>
        Om PadelMakker
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/faq" style={linkStyle}>
        FAQ
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/elo" style={linkStyle}>
        ELO
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/events" style={linkStyle}>
        Events
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/hjaelp" style={linkStyle}>
        Hjælp
      </Link>
      <span aria-hidden style={{ color: theme.border }}>
        ·
      </span>
      <Link to="/app" style={linkStyle}>
        Installér app
      </Link>
    </footer>
  );
}

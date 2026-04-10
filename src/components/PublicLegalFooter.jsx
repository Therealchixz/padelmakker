import { Link } from 'react-router-dom';
import { theme } from '../lib/platformTheme';

/** @param {{ tone?: 'light' | 'dark' }} [props] */
export function PublicLegalFooter({ tone = 'light' } = {}) {
  const dark = tone === 'dark'
  const linkColor = dark ? '#93C5FD' : theme.accent
  const muted = dark ? '#64748B' : theme.textLight
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
      <Link to="/privatlivspolitik" style={linkStyle}>
        Privatlivspolitik
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/handelsbetingelser" style={linkStyle}>
        Handelsbetingelser
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/cookies" style={linkStyle}>
        Cookies
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/om" style={linkStyle}>
        Om PadelMakker
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/faq" style={linkStyle}>
        FAQ
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/elo" style={linkStyle}>
        ELO
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/events" style={linkStyle}>
        Events
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/hjaelp" style={linkStyle}>
        Hjælp
      </Link>
      <span aria-hidden style={{ color: sep }}>
        ·
      </span>
      <Link to="/app" style={linkStyle}>
        Installér app
      </Link>
    </footer>
  );
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn } from '../lib/platformTheme';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const homePath = session ? '/dashboard/hjem' : '/';
  const homeLabel = session ? 'Gå til dashboard' : 'Gå til forsiden';

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: theme.bg,
        textAlign: 'center',
      }}
    >
      <div className="pm-not-found">
        <div style={{ fontSize: '64px', marginBottom: '16px' }} aria-hidden="true">🎾</div>
        <h1 className="pm-not-found__code">404</h1>
        <p style={{ fontSize: '18px', fontWeight: 600, color: theme.text, marginBottom: '8px' }}>Siden findes ikke</p>
        <p style={{ fontSize: '14px', color: theme.textMid, marginBottom: '32px', lineHeight: 1.5 }}>
          {session
            ? 'Linket findes ikke længere. Gå tilbage til dashboard og prøv igen.'
            : 'Det ser ud til at bolden er landet udenfor banen. Prøv at gå tilbage til forsiden.'}
        </p>
        <button type="button" onClick={() => navigate(homePath)} style={{ ...btn(true), padding: '12px 28px', fontSize: '15px' }}>
          {homeLabel}
        </button>
      </div>
    </div>
  );
}

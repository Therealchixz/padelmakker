import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function HelpContactPage() {
  return (
    <LegalPageLayout title="Hjælp og kontakt">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        Har du spørgsmål, problemer med login eller forslag til PadelMakker? Vi hjælper gerne.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Skriv til os</h2>
      <p style={{ color: theme.textMid }}>
        Email:{' '}
        <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>
          kontakt@padelmakker.dk
        </a>
      </p>
      <p style={{ color: theme.textMid }}>
        Vi bestræber os på at svare inden for et par hverdage. Ved tekniske fejl: beskriv gerne hvad du gjorde, hvilken
        browser/telefon du bruger, og om muligt et skærmbillede.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Find svar selv</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid }}>
        <li style={{ marginBottom: '10px' }}>
          <Link to="/faq" style={{ color: theme.accent, fontWeight: 600 }}>
            Ofte stillede spørgsmål (FAQ)
          </Link>{' '}
          — pris, ELO, baner, regioner, konto.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <Link to="/app" style={{ color: theme.accent, fontWeight: 600 }}>
            Installér appen på telefonen
          </Link>{' '}
          — PWA på iPhone og Android.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <Link to="/events" style={{ color: theme.accent, fontWeight: 600 }}>
            Kommende events
          </Link>{' '}
          — åbne Americano-turneringer.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <Link to="/om" style={{ color: theme.accent, fontWeight: 600 }}>
            Om PadelMakker
          </Link>
        </li>
      </ul>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Baner og booking</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Priser, afbestilling og betaling aftales med det enkelte center og dets booking-system. PadelMakker viser overblik
        og hjælper dig videre til deres side.
      </p>
    </LegalPageLayout>
  );
}

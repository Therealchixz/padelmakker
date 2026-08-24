import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

function Rule({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '0 0 8px', lineHeight: 1.35 }}>{title}</h2>
      <div style={{ color: theme.textMid, fontSize: '14px', lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

export function CampaignRulesPage() {
  return (
    <LegalPageLayout title="Første 200 — regler">
      <p style={{ marginTop: 0, color: theme.textMid, lineHeight: 1.65 }}>
        De første 200 spillere med udfyldt profil og bekræftet e-mail og telefon deltager i lodtrækning om en padel-præmie. Kampagnen gælder både
        eksisterende og nye brugere — pladserne fordeles efter hvem der først opfylder kravene.
      </p>

      <Rule title="Hvem kan deltage?">
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Du har bekræftet e-mail og telefonnummer med SMS (eller er undtaget af admin for SMS).</li>
          <li>Din profil er udfyldt: navn, fødselsår og spillestil. Spilledag er ikke et krav.</li>
          <li>Du accepterer at deltage i lodtrækningen, når du er kvalificeret.</li>
        </ul>
      </Rule>

      <Rule title="Hvordan får jeg en plads?">
        <p style={{ margin: 0 }}>
          Når du opfylder kravene, tilmeldes du automatisk og får et lodnummer (1–200). Eksisterende kvalificerede
          brugere tæller med fra start — sorteret efter hvornår profilen blev oprettet.
        </p>
      </Rule>

      <Rule title="Præmie og lodtrækning">
        <p style={{ margin: 0 }}>
          Præmien er en padel-pakke (bolde og greb). Det præcise indhold annonceres inden lodtrækning. Vinderen
          kontaktes via appen/e-mail. Lodtrækningen gennemføres, når de 200 pladser er fyldt eller kampagnen
          afsluttes.
        </p>
      </Rule>

      <Rule title="Månedens mester">
        <p style={{ margin: 0 }}>
          Månedens mester (top 1 på månedlig rangliste) er annonceret som &quot;Kommer snart&quot; og aktiveres
          først, når der er nok aktive spillere på platformen.
        </p>
      </Rule>

      <Rule title="Spørgsmål?">
        <p style={{ margin: 0 }}>
          Skriv til{' '}
          <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>
            kontakt@padelmakker.dk
          </a>
          .
        </p>
      </Rule>

      <p style={{ margin: '28px 0 0', fontSize: '13px', color: theme.textLight }}>
        <Link to="/" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
          ← Til forsiden
        </Link>
      </p>
    </LegalPageLayout>
  );
}

import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_INFO } from '../lib/legalInfo';
import { theme } from '../lib/platformTheme';

export function OmPage() {
  return (
    <LegalPageLayout title="Om PadelMakker">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        PadelMakker er en dansk platform, der samler <strong style={{ color: theme.text }}>makkersøgning</strong>,{' '}
        <strong style={{ color: theme.text }}>kampe og ELO</strong>, <strong style={{ color: theme.text }}>turneringer (Americano/Mexicano)</strong> og{' '}
        <strong style={{ color: theme.text }}>overblik over ledige banetider</strong> hos udvalgte centre — så du hurtigere kan
        fra idé til kamp.
      </p>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Hvad kan du bruge det til?</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        <li style={{ marginBottom: '8px' }}>Finde og invitere spillere på dit niveau (region og præferencer på profilen).</li>
        <li style={{ marginBottom: '8px' }}>Registrere 2v2-resultater og følge din ELO-udvikling over tid.</li>
        <li style={{ marginBottom: '8px' }}>Se ledige tider og gå videre til centrets eget booking-flow, når du har fundet et tidspunkt.</li>
        <li style={{ marginBottom: '8px' }}>Køre Americano- og Mexicano-turneringer med rundeplan, stilling og separat Turnerings-ELO.</li>
      </ul>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Centre med baner-overblik i appen</h2>
      <p style={{ color: theme.textMid }}>
        Vi viser ledige tider fra centre, der er tilkoblet — herunder blandt andet{' '}
        <strong style={{ color: theme.text }}>Skansen Padel</strong>, <strong style={{ color: theme.text }}>Padel Lounge Aalborg</strong>,{' '}
        <strong style={{ color: theme.text }}>Match Padel</strong> (via Halbooking) og{' '}
        <strong style={{ color: theme.text }}>PadelPadel Aalborg</strong> (Bookli). Listen kan udvides over tid.
      </p>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Kontakt og virksomhed</h2>
      <p style={{ color: theme.textMid }}>
        {LEGAL_INFO.legalName} · CVR-nr. {LEGAL_INFO.cvr}
      </p>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Spørgsmål eller feedback:{' '}
        <a href={`mailto:${LEGAL_INFO.email}`} style={{ color: theme.accent, fontWeight: 600 }}>
          {LEGAL_INFO.email}
        </a>
      </p>
    </LegalPageLayout>
  );
}

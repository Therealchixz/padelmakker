import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_INFO } from '../lib/legalInfo';
import { theme } from '../lib/platformTheme';

export function OmPage() {
  return (
    <LegalPageLayout title="Om PadelMakker">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        PadelMakker er en dansk platform, der samler <strong style={{ color: theme.text }}>makkersøgning</strong>,{' '}
        <strong style={{ color: theme.text }}>2v2-kampe og Liga</strong>, <strong style={{ color: theme.text }}>ELO og rangliste</strong>,{' '}
        <strong style={{ color: theme.text }}>Americano/Mexicano</strong>, <strong style={{ color: theme.text }}>beskeder</strong> og{' '}
        <strong style={{ color: theme.text }}>overblik over ledige banetider</strong> hos tilkoblede centre — så du hurtigere kommer
        fra idé til kamp.
      </p>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Hvad kan du bruge det til?</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        <li style={{ marginBottom: '8px' }}>Finde spillere på dit niveau med forslag, filtre, favoritter og aktiv søgning.</li>
        <li style={{ marginBottom: '8px' }}>Oprette eller tilslutte dig åbne/lukkede 2v2-kampe, bekræfte resultater og følge din ELO.</li>
        <li style={{ marginBottom: '8px' }}>Spille Liga med hold, stilling, kampprogram og hold-chat.</li>
        <li style={{ marginBottom: '8px' }}>Køre Americano- og Mexicano-turneringer med rundeplan, stilling og separat Turnerings-ELO.</li>
        <li style={{ marginBottom: '8px' }}>Se dig selv på ranglisten (2v2 og turnering) efter region og periode.</li>
        <li style={{ marginBottom: '8px' }}>Chatte privat, i kampen eller på holdet — og få notifikationer når noget sker.</li>
        <li style={{ marginBottom: '8px' }}>Se ledige tider og gå videre til centrets eget booking-flow, når I har fundet et tidspunkt.</li>
      </ul>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Centre med baner-overblik i appen</h2>
      <p style={{ color: theme.textMid }}>
        Vi viser ledige tider fra 150+ tilkoblede centre i hele Danmark — via{' '}
        <strong style={{ color: theme.text }}>Halbooking</strong>, <strong style={{ color: theme.text }}>MATCHi</strong>,{' '}
        <strong style={{ color: theme.text }}>Bookli</strong> og <strong style={{ color: theme.text }}>Playtomic</strong>.
        Det dækker blandt andet Match Padel, Padel Lounge, Smash, Padelboxen, Padel.dk og mange lokale klubber. Når du
        finder en ledig tid, sendes du videre til centrets eget booking-system. Listen udvides løbende.
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

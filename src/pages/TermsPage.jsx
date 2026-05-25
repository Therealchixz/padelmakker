import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_INFO } from '../lib/legalInfo';
import { theme } from '../lib/platformTheme';

const h2 = { fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' };
const p = { color: theme.textMid };

export function TermsPage() {
  return (
    <LegalPageLayout title="Handelsbetingelser">
      <h2 style={h2}>Accept</h2>
      <p style={p}>
        Ved at oprette konto eller bruge tjenesten accepterer du disse betingelser og vores{' '}
        <Link to="/privatlivspolitik" style={{ color: theme.accent, fontWeight: 600 }}>
          privatlivspolitik
        </Link>
        . Hvis du ikke accepterer dem, må du ikke bruge {LEGAL_INFO.brand}. Tjenesten udbydes af {LEGAL_INFO.legalName},
        CVR-nr. {LEGAL_INFO.cvr}.
      </p>

      <h2 style={h2}>Alderskrav</h2>
      <p style={p}>
        Du skal være mindst {LEGAL_INFO.minAgeYears} år for at oprette konto, medmindre du har en værges samtykke og
        ansvar for brugen.
      </p>

      <h2 style={h2}>Tjenestens indhold</h2>
      <p style={p}>
        {LEGAL_INFO.brand} stilles til rådighed som den er. Vi bestræber os på stabil drift, men garanterer ikke uafbrudt
        adgang eller fejlfri funktion. Funktioner kan ændres eller udfases.
      </p>

      <h2 style={h2}>Brugerkonto og adfærd</h2>
      <p style={p}>
        Du er ansvarlig for at holde loginoplysninger hemmelige og for aktivitet på din konto. Du må ikke misbruge
        tjenesten (fx chikane, falske profiler, automatisering der belaster systemet, eller ulovligt indhold). Vi kan
        suspendere eller slette konti ved overtrædelse.
      </p>

      <h2 style={h2}>Baner og betaling</h2>
      <p style={p}>
        Overblik over ledige tider er kun til orientering. Endelig booking, pris, afbestilling og klageforhold sker direkte
        hos det pågældende center og dets booking-system — ikke hos {LEGAL_INFO.brand}.
      </p>

      <h2 style={h2}>Immaterielle rettigheder</h2>
      <p style={p}>
        Navn, design, kode og indhold, som {LEGAL_INFO.brand} stiller til rådighed, tilhører {LEGAL_INFO.legalName} eller
        licensgivere. Du må ikke kopiere eller reverse-engineere tjenesten uden skriftlig aftale.
      </p>

      <h2 style={h2}>Ansvarsbegrænsning</h2>
      <p style={p}>
        I det omfang loven tillader det, er {LEGAL_INFO.brand} ikke erstatningsansvarlig for indirekte tab, tab af data,
        aflysning af kampe eller uenighed mellem spillere. Din brug sker på eget ansvar.
      </p>

      <h2 style={h2}>Gældende lov og klage</h2>
      <p style={{ marginBottom: 0, ...p }}>
        Vilkår er underlagt dansk ret. Eventuelle tvister søges løst i mindelighed; klager kan rettes til{' '}
        <a href={`mailto:${LEGAL_INFO.email}`} style={{ color: theme.accent, fontWeight: 600 }}>
          {LEGAL_INFO.email}
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}

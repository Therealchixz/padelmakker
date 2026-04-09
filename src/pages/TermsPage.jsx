import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function TermsPage() {
  return (
    <LegalPageLayout title="Handelsbetingelser">
      <p style={{ marginTop: 0, fontSize: '13px', color: theme.textLight }}>
        Senest opdateret: april 2026. Disse vilkår regulerer brugen af PadelMakker som digital tjeneste. De bør gennemgås af juridisk
        rådgiver før endelig publicering.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Accept</h2>
      <p style={{ color: theme.textMid }}>
        Ved at oprette konto eller bruge tjenesten accepterer du disse betingelser. Hvis du ikke accepterer dem, må du ikke bruge
        PadelMakker.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Tjenestens indhold</h2>
      <p style={{ color: theme.textMid }}>
        PadelMakker stilles til rådighed som den er. Vi bestræber os på stabil drift, men garanterer ikke uafbrudt adgang eller
        fejlfri funktion. Funktioner kan ændres eller udfases.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Brugerkonto og adfærd</h2>
      <p style={{ color: theme.textMid }}>
        Du er ansvarlig for at holde loginoplysninger hemmelige og for aktivitet på din konto. Du må ikke misbruge tjenesten (fx
        chikane, falske profiler, automatisering der belaster systemet, eller ulovligt indhold). Vi kan suspendere eller slette
        konti ved overtrædelse.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Baner og betaling</h2>
      <p style={{ color: theme.textMid }}>
        Overblik over ledige tider er kun til orientering. Endelig booking, pris, afbestilling og klageforhold sker direkte hos det
        pågældende center og dets booking-system — ikke hos PadelMakker.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Immaterielle rettigheder</h2>
      <p style={{ color: theme.textMid }}>
        Navn, design, kode og indhold, som PadelMakker stiller til rådighed, tilhører PadelMakker eller licensgivere. Du må ikke
        kopiere eller reverse-engineere tjenesten uden skriftlig aftale.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Ansvarsbegrænsning</h2>
      <p style={{ color: theme.textMid }}>
        I det omfang loven tillader det, er PadelMakker ikke erstatningsansvarlig for indirekte tab, tab af data, aflysning af
        kampe eller uenighed mellem spillere. Din brug sker på eget ansvar.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Gældende lov og klage</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Vilkår er underlagt dansk ret. Eventuelle tvister søges løst i mindelighed; klager kan rettes til kontakt@padelmakker.dk.
      </p>
    </LegalPageLayout>
  );
}

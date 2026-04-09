import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privatlivspolitik">
      <p style={{ marginTop: 0, fontSize: '13px', color: theme.textLight }}>
        Senest opdateret: april 2026. PadelMakker drives som en digital tjeneste; denne tekst beskriver kort, hvordan vi behandler
        personoplysninger. Den er ikke juridisk rådgivning — tilpas den gerne med jeres advokat før endelig publicering.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Dataansvarlig</h2>
      <p style={{ color: theme.textMid }}>
        PadelMakker / den juridiske enhed, der driver tjenesten. Kontakt:{' '}
        <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>
          kontakt@padelmakker.dk
        </a>
        .
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Hvilke oplysninger vi behandler</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid }}>
        <li style={{ marginBottom: '8px' }}>
          <strong style={{ color: theme.text }}>Konto:</strong> e-mail og adgangskode (krypteret hos autentificeringsleverandør),
          sessions til login.
        </li>
        <li style={{ marginBottom: '8px' }}>
          <strong style={{ color: theme.text }}>Profil:</strong> navn, region, niveau, spillestil, tilgængelighed, bio, avatar
          (emoji) og andre felter du selv udfylder i appen.
        </li>
        <li style={{ marginBottom: '8px' }}>
          <strong style={{ color: theme.text }}>Aktivitet:</strong> kampe, resultater, ranking/ELO-historik, Americano-deltagelse
          og notifikationer knyttet til appen.
        </li>
        <li style={{ marginBottom: '8px' }}>
          <strong style={{ color: theme.text }}>Teknisk:</strong> browser-/app-oplysninger der er nødvendige for drift, sikkerhed
          og fejlretning (fx IP i serverlogs hos hosting).
        </li>
      </ul>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Formål og grundlag</h2>
      <p style={{ color: theme.textMid }}>
        Vi behandler data for at levere tjenesten (brugerkonto, matching, kampe, baner-overblik), forbedre sikkerhed og
        fejlfinde, og kommunikere med dig om kontoen. Behandlingen sker efter GDPR — typisk som nødvendig for kontrakten (art. 6
        stk. 1 litra b) og/eller berettiget interesse (art. 6 stk. 1 litra f) for sikker drift.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Underleverandører</h2>
      <p style={{ color: theme.textMid }}>
        Appen bruger <strong style={{ color: theme.text }}>Supabase</strong> til database, autentificering og API samt{' '}
        <strong style={{ color: theme.text }}>Vercel</strong> (eller tilsvarende) til hosting. Data kan lagres inden for EU/EØS
        afhængigt af jeres opsætning — tjek altid region i jeres Supabase- og Vercel-projekter.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Opbevaring</h2>
      <p style={{ color: theme.textMid }}>
        Vi opbevarer oplysninger, så længe du har en aktiv konto, og derefter så længe det er nødvendigt af hensyn til lovkrav,
        dokumentation eller legitime interesser. Konkrete slettefrister kan I fastlægge internt og opdatere her.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Dine rettigheder</h2>
      <p style={{ color: theme.textMid }}>
        Efter GDPR har du blandt andet ret til indsigt, berigtigelse, sletning, begrænsning og dataportabilitet (hvor det gælder).
        Du kan klage til Datatilsynet. Kontakt os på kontakt@padelmakker.dk for anmodninger.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Ændringer</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Vi kan opdatere denne politik; datoen øverst ændres ved væsentlige opdateringer. Fortsat brug efter ændring kan betragtes
        som accept, medmindre loven kræver andet.
      </p>
    </LegalPageLayout>
  );
}

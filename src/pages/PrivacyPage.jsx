import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_INFO } from '../lib/legalInfo';
import { theme } from '../lib/platformTheme';

const h2 = { fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' };
const p = { color: theme.textMid };
const li = { marginBottom: '8px' };

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privatlivspolitik">
      <h2 style={h2}>Dataansvarlig</h2>
      <p style={p}>
        Dataansvarlig for behandlingen af personoplysninger i forbindelse med {LEGAL_INFO.brand} er{' '}
        <strong style={{ color: theme.text }}>{LEGAL_INFO.legalName}</strong>, CVR-nr. {LEGAL_INFO.cvr},{' '}
        der driver tjenesten på{' '}
        <a href={LEGAL_INFO.siteUrl} style={{ color: theme.accent, fontWeight: 600 }}>
          {LEGAL_INFO.siteUrl.replace(/^https:\/\//, '')}
        </a>
        . Kontakt ved spørgsmål om privatliv:{' '}
        <a href={`mailto:${LEGAL_INFO.email}`} style={{ color: theme.accent, fontWeight: 600 }}>
          {LEGAL_INFO.email}
        </a>
        .
      </p>

      <h2 style={h2}>Hvilke oplysninger vi behandler</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid }}>
        <li style={li}>
          <strong style={{ color: theme.text }}>Konto og login:</strong> e-mail, adgangskode (krypteret hos vores
          autentificeringsleverandør), telefonnummer til SMS-bekræftelse, sessions og login-metode (e-mail eller Google).
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Profil:</strong> navn, region, by, niveau, spillestil, bane-side,
          tilgængelighed, bio, valgt avatar (emoji eller uploadet billede) og andre felter du selv udfylder.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Aktivitet:</strong> kampe, resultater, ranking/ELO-historik,
          Americano-deltagelse, makkersøgning, beskeder/notifikationer i appen og præferencer for notifikationer.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Push-notifikationer:</strong> hvis du tilmelder dig browser-push,
          gemmer vi et teknisk abonnement (endpoint og nøgler) så vi kan sende relevante beskeder — du kan til enhver tid
          framelde dig i appen eller i browseren.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Teknisk og sikkerhed:</strong> IP-adresse, browser/enhedsoplysninger,
          tidsstempler og logdata hos hosting og database, som er nødvendige for drift, sikkerhed, misbrugsforebyggelse og
          fejlretning (herunder captcha ved login/opret).
        </li>
      </ul>

      <h2 style={h2}>Formål og retsgrundlag</h2>
      <p style={p}>
        Vi behandler oplysninger for at levere tjenesten (brugerkonto, matching, kampe, baner-overblik, events),
        verificere identitet (SMS/e-mail), forbedre sikkerhed og fejlfinde, samt kommunikere med dig om kontoen og
        notifikationer du har bedt om. Behandlingen sker efter GDPR — typisk som nødvendig for at opfylde aftalen med dig
        (art. 6 stk. 1 litra b), samtykke hvor det kræves (fx push, litra a), og berettiget interesse i sikker drift og
        misbrugsforebyggelse (art. 6 stk. 1 litra f).
      </p>

      <h2 style={h2}>Underleverandører (databehandlere)</h2>
      <p style={p}>
        Vi bruger betroede leverandører, der behandler data på vores vegne og kun efter vores instruks:
      </p>
      <ul style={{ margin: '0 0 12px', paddingLeft: '1.25rem', color: theme.textMid }}>
        <li style={li}>
          <strong style={{ color: theme.text }}>Supabase</strong> — database, autentificering, API og fil-lagring.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Vercel</strong> — hosting af webappen og levering af sider til din browser.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Twilio</strong> — udsendelse af SMS-koder til telefonbekræftelse (via
          Supabase Auth).
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Google</strong> — hvis du vælger “Log ind med Google”; Google behandler
          oplysninger efter deres egne vilkår som selvstændig dataansvarlig for den del.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Cloudflare Turnstile</strong> — sikkerhedscheck (captcha) ved login og
          oprettelse, når det er aktiveret.
        </li>
      </ul>
      <p style={p}>
        Database og autentificering hos Supabase er konfigureret til hosting inden for <strong style={{ color: theme.text }}>EU/EØS</strong>.
        Vercel leverer indhold fra deres netværk; personoplysninger i appen lagres primært hos Supabase, ikke hos
        bookingcentre, når du klikker videre til eksterne bookingsider.
      </p>

      <h2 style={h2}>Eksterne bookinglinks</h2>
      <p style={p}>
        Når du booker bane hos et center (fx via Halbooking, MATCHi, Bookli, Playtomic eller centrets egen side), gælder det
        pågældende centres privatlivspolitik. PadelMakker modtager typisk ikke dine betalingsoplysninger fra disse systemer.
      </p>

      <h2 style={h2}>Opbevaring</h2>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid }}>
        <li style={li}>
          <strong style={{ color: theme.text }}>Aktiv konto:</strong> profil, kampe og tilknyttede data opbevares, så
          længe du har en konto og bruger tjenesten.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Sletning:</strong> når du beder om sletning eller vi lukker din konto,
          sletter eller anonymiserer vi personoplysninger, der ikke skal gemmes længere — som udgangspunkt inden for{' '}
          <strong style={{ color: theme.text }}>30 dage</strong>, medmindre længere opbevaring er påkrævet ved lov eller
          nødvendig for at håndtere tvister.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Tekniske logs:</strong> server- og sikkerhedslogs opbevares typisk i op til{' '}
          <strong style={{ color: theme.text }}>90 dage</strong>, medmindre længere periode er nødvendig ved sikkerhedshændelser.
        </li>
        <li style={li}>
          <strong style={{ color: theme.text }}>Backups:</strong> kan indeholde slettede data i en kort periode, indtil
          backup-cyklusser er roteret.
        </li>
      </ul>

      <h2 style={h2}>Aldersgrænse</h2>
      <p style={p}>
        Tjenesten er rettet mod personer på mindst <strong style={{ color: theme.text }}>{LEGAL_INFO.minAgeYears} år</strong>.
        Opretter du konto som forælder/værge for en mindreårig, er du ansvarlig for, at brugen sker i overensstemmelse med
        gældende regler.
      </p>

      <h2 style={h2}>Dine rettigheder</h2>
      <p style={p}>
        Efter GDPR har du blandt andet ret til indsigt, berigtigelse, sletning, begrænsning af behandling og
        dataportabilitet (hvor det gælder). Du kan klage til{' '}
        <a href="https://www.datatilsynet.dk" style={{ color: theme.accent, fontWeight: 600 }}>
          Datatilsynet
        </a>
        . Kontakt os på{' '}
        <a href={`mailto:${LEGAL_INFO.email}`} style={{ color: theme.accent, fontWeight: 600 }}>
          {LEGAL_INFO.email}
        </a>{' '}
        for anmodninger — vi svarer som udgangspunkt inden for en måned.
      </p>

      <h2 style={h2}>Ændringer</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Vi kan opdatere denne politik; væsentlige ændringer fremgår af datoen øverst. Ved fortsat brug efter opdatering
        accepterer du den gældende version, medmindre loven kræver særskilt samtykke.
      </p>
    </LegalPageLayout>
  );
}

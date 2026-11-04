import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme, displayFont } from '../lib/platformTheme';

const strong = { color: theme.text };

/** Ét spørgsmål som fold-ud (details/summary): kort liste at skimme, svaret når man vil læse det. */
function Q({ title, children }) {
  return (
    <details className="pm-faq-item">
      <summary>{title}</summary>
      <div className="pm-faq-answer">{children}</div>
    </details>
  );
}

function Group({ id, title, children }) {
  return (
    <section aria-labelledby={id} style={{ marginTop: '28px' }}>
      <h2 id={id} style={{ fontFamily: displayFont, fontSize: '19px', fontWeight: 700, color: theme.text, margin: '0 0 6px' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const groups = [
  { id: 'faq-kom-i-gang', label: 'Kom i gang' },
  { id: 'faq-kampe', label: 'Kampe og ELO' },
  { id: 'faq-konto', label: 'Konto og data' },
];

export function FaqPage() {
  return (
    <LegalPageLayout title="Ofte stillede spørgsmål" showUpdated={false} showSignupCta>
      <p style={{ marginTop: 0, marginBottom: '12px', color: theme.textMid }}>
        Her er svar på det, mange spørger om første gang. Finder du ikke det, du leder efter, så skriv til{' '}
        <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>
          kontakt@padelmakker.dk
        </a>
        .
      </p>
      <nav aria-label="Emner" style={{ display: 'flex', flexWrap: 'wrap', gap: '0 16px' }}>
        {groups.map((g) => (
          <a key={g.id} href={`#${g.id}`} style={{ color: theme.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>
            {g.label}
          </a>
        ))}
      </nav>

      <Group id="faq-kom-i-gang" title="Kom i gang">
        <Q title="Koster PadelMakker noget?">
          <p>
            Nej, det er gratis at oprette profil og bruge appen. Baner bookes hos centrene, og deres priser og vilkår gælder dér.
          </p>
        </Q>

        <Q title="Hvordan opretter jeg en profil?">
          <p>
            Du udfylder fire korte trin (dig, dit niveau, dit område og din profil) og bekræfter dit telefonnummer med en
            SMS-kode. Så er du inde. Du kan også starte med <strong style={strong}>Google</strong>, så slipper du for at vælge
            en adgangskode. SMS-koden kræves stadig.
          </p>
        </Q>

        <Q title="Hvorfor skal jeg bekræfte telefon og e-mail?">
          <p>
            SMS-koden sikrer, at hver spiller er en rigtig person, så der ikke er falske profiler. Den kræves, før du kommer ind.
            E-mailen bekræfter du bagefter med det link, vi sender. Den bruges, hvis du glemmer din adgangskode, og til vigtige
            beskeder om din konto.
          </p>
        </Q>

        <Q title="Hvilke områder kan jeg vælge?">
          <p>
            De otte landsdele: Nordjylland, Vestjylland, Østjylland, Sydjylland, Fyn, Sjælland, Hovedstaden og Bornholm.
            Du vælger også din by, så forslag til makkere og kampe passer til, hvor du helst spiller.
          </p>
        </Q>

        <Q title="Får jeg notifikationer?">
          <p>
            Ja. Du får notifikationer i appen og push-beskeder på telefonen, hvis du tillader det eller har lagt PadelMakker på
            din hjemmeskærm. Det gælder fx kampinvitationer, beskeder og resultater, der skal bekræftes. Du kan også få en e-mail
            om nye makkere og kampe, der passer dig. Du styrer det hele under notifikationsklokken.
          </p>
        </Q>
      </Group>

      <Group id="faq-kampe" title="Kampe og ELO">
        <Q title="Hvordan virker ELO?">
          <p>
            ELO er din rating. Når en 2v2-kamp er spillet og bekræftet af modstanderne, går din rating op ved sejr og ned ved
            nederlag. Slår du et stærkere hold, får du flere point. Du og din makker kan få forskellige point i samme kamp, fordi
            I hver især sammenlignes med modstandernes niveau.
          </p>
          <p>
            <Link to="/elo" style={{ color: theme.accent, fontWeight: 600 }}>
              Se et eksempel og hele udregningen →
            </Link>
          </p>
        </Q>

        <Q title="Hvordan bekræftes et kampresultat?">
          <p>
            Når resultatet er indtastet, skal modstanderholdet bekræfte det, før ELO opdateres. Det holder ranglisten fair og
            fanger tastefejl.
          </p>
        </Q>

        <Q title="Hvad er forskellen på åbne og lukkede 2v2-kampe?">
          <p>
            <strong style={strong}>Åbne</strong> kampe kan andre melde sig til direkte (eller på venteliste, hvis kampen er fuld).{' '}
            <strong style={strong}>Lukkede</strong> kampe kræver, at opretteren godkender, hvem der spiller. Det er praktisk, når I
            allerede har aftalt holdene.
          </p>
        </Q>

        <Q title="Hvad er Americano og Mexicano?">
          <p>
            To sjove turneringsformer for 4 til 16 spillere, hvor man skifter makker undervejs.
          </p>
          <ul>
            <li>
              <strong style={strong}>Americano:</strong> Du spiller med en ny makker i hver runde. Hver kamp spilles til et fast
              antal point (16, 24 eller 32), og dine point lægges sammen. Flest point vinder.
            </li>
            <li>
              <strong style={strong}>Mexicano:</strong> Samme idé, men efter hver runde sættes holdene ud fra stillingen, så du
              møder spillere på dit eget niveau, efterhånden som turneringen skrider frem.
            </li>
          </ul>
          <p>PadelMakker laver rundeplanen og holder stillingen for jer.</p>
        </Q>

        <Q title="Tæller turneringer med i min almindelige ELO?">
          <p>
            Nej. Americano og Mexicano har deres egen <strong style={strong}>Turnerings-ELO</strong>, som holdes adskilt fra din
            2v2-ELO, så de to ikke påvirker hinanden.
          </p>
        </Q>

        <Q title="Hvad er Liga?">
          <p>
            Liga er holdturneringer i appen. I opretter eller melder jer til med et hold, spiller efter et kampprogram og følger
            stillingen. Holdet har sin egen chat, så I kan aftale tider.
          </p>
        </Q>

        <Q title="Hvad er aktiv søgning?">
          <p>
            Når du markerer dig som klar til kamp, kan andre se, at du søger makker eller kamp lige nu. Det er praktisk, når I vil
            finde nogen samme dag uden at skrive rundt.
          </p>
        </Q>

        <Q title="Booker jeg banen direkte i PadelMakker?">
          <p>
            I appen kan du se ledige tider hos 150+ centre. Når du vil booke, sendes du videre til centrets eget system (fx
            Halbooking, MATCHi, Bookli eller Playtomic), så betaling og afbestilling følger deres regler.
          </p>
        </Q>
      </Group>

      <Group id="faq-konto" title="Konto og data">
        <Q title="Jeg kan ikke logge ind. Hvad gør jeg?">
          <p>
            Du kan logge ind med enten din e-mail eller dit telefonnummer og din adgangskode. Har du glemt adgangskoden, så tryk
            på «Glemt adgangskode?» på login-siden, så sender vi et link til din e-mail. Har du kun bekræftet dit telefonnummer og
            ikke din e-mail, så skriv til{' '}
            <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>kontakt@padelmakker.dk</a>,
            så hjælper vi.
          </p>
        </Q>

        <Q title="Kan jeg slette min profil?">
          <p>
            Ja. Skriv til kontakt@padelmakker.dk, så sletter vi din konto og dine persondata. Læs mere i{' '}
            <Link to="/privatlivspolitik" style={{ color: theme.accent, fontWeight: 600 }}>privatlivspolitikken</Link>.
          </p>
        </Q>
      </Group>
    </LegalPageLayout>
  );
}

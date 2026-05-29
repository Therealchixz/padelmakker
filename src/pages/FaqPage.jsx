import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

function Q({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '0 0 10px', lineHeight: 1.35 }}>{title}</h2>
      <div style={{ color: theme.textMid }}>{children}</div>
    </div>
  );
}

export function FaqPage() {
  return (
    <LegalPageLayout title="Ofte stillede spørgsmål">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        Her er svar på det, mange spørger om første gang. Finder du ikke det, du leder efter, så skriv til{' '}
        <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent, fontWeight: 600 }}>
          kontakt@padelmakker.dk
        </a>
        .
      </p>

      <Q title="Koster PadelMakker noget?">
        <p style={{ margin: 0 }}>
          Det er gratis at oprette profil og bruge kernefunktionerne. Baner bookes hos centrene — deres priser og vilkår gælder
          der.
        </p>
      </Q>

      <Q title="Hvordan virker ELO?">
        <p style={{ margin: 0 }}>
          Når en 2v2-kamp er bekræftet, opdateres <strong style={{ color: theme.text }}>din personlige 2v2-ELO</strong> ud fra <strong style={{ color: theme.text }}>dit niveau mod modstanderholdets snit</strong>.
          Du og din makker kan derfor få forskellige point i samme kamp.
        </p>
        <p style={{ margin: '12px 0 0' }}>
          <Link to="/elo" style={{ color: theme.accent, fontWeight: 600 }}>
            Læs mere om ELO (individuel forventning, dynamisk K-faktor og sejrsmargin)
          </Link>
        </p>
      </Q>

      <Q title="Tæller turneringer (Americano/Mexicano) med i min almindelige ELO?">
        <p style={{ margin: 0 }}>
          Nej. Americano og Mexicano deler <strong style={{ color: theme.text }}>Turnerings-ELO</strong>, som holdes adskilt fra din 2v2-ELO, så de to spor ikke påvirker hinanden.
        </p>
      </Q>

      <Q title="Booker jeg banen direkte i PadelMakker?">
        <p style={{ margin: 0 }}>
          I appen kan du se ledige tider hos tilkoblede centre. Når du vil booke, sendes du videre til centrets eget system
          (fx Halbooking eller Bookli), så betaling og afbestilling følger deres regler.
        </p>
      </Q>

      <Q title="Hvilke regioner understøttes?">
        <p style={{ margin: 0 }}>
          Profilen bruger de samme otte landsdele som under Baner (Nordjylland, Vestjylland, Østjylland, Sydjylland,
          Fyn, Sjælland, Hovedstaden og Bornholm), så du kan angive præcis hvor du helst spiller.
        </p>
      </Q>

      <Q title="Hvorfor skal jeg bekræfte min e-mail?">
        <p style={{ margin: 0 }}>
          Bekræftelse beskytter mod misbrug og sikrer, at du kan nulstille adgangskode og modtage vigtige beskeder om kontoen.
        </p>
      </Q>

      <Q title="Kan jeg slette min profil?">
        <p style={{ margin: 0 }}>
          Kontakt os på kontakt@padelmakker.dk, hvis du ønsker konto og persondata slettet — så hjælper vi med det manuelt eller
          henviser til den funktion, der på det tidspunkt findes i appen.
        </p>
      </Q>
    </LegalPageLayout>
  );
}

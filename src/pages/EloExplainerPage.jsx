import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function EloExplainerPage() {
  return (
    <LegalPageLayout title="Sådan virker ELO på PadelMakker">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        ELO er et rating-system, der forsøger at afspejle dit niveau ud fra resultater mod andre spillere. Her er hvordan vi bruger
        det i 2v2-padel — kort og praktisk.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Hvornår opdateres min rating?</h2>
      <p style={{ color: theme.textMid }}>
        Når en kamp er <strong style={{ color: theme.text }}>afsluttet</strong> og{' '}
        <strong style={{ color: theme.text }}>begge hold har bekræftet resultatet</strong>, opdateres <strong style={{ color: theme.text }}>hver spillers</strong> ELO
        for sig. Du og din makker kan derfor få <strong style={{ color: theme.text }}>forskellige</strong> point i samme kamp — se nedenfor.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Individuel forventning (dit niveau mod deres hold)</h2>
      <p style={{ color: theme.textMid }}>
        Vi bruger <strong style={{ color: theme.text }}>modstanderholdets gennemsnitlige rating</strong> (de to modstandere tilsammen) som
        reference for <strong style={{ color: theme.text }}>dig</strong>. Din forventede score beregnes ud fra <strong style={{ color: theme.text }}>din</strong> rating
        mod det snit — ikke ud fra hele dit holds snit alene. Makkeren får sin egen forventning på samme måde.
      </p>
      <p style={{ color: theme.textMid }}>
        <strong style={{ color: theme.text }}>Konsekvens:</strong> Er du fx højere rated end din makker, regner systemet typisk med, at du
        har bedre chancer mod modstandernes snit end makkeren. Ved sejr kan makkeren derfor få et <strong style={{ color: theme.text }}>større</strong> plus end dig; ved
        nederlag kan du tabe <strong style={{ color: theme.text }}>mere</strong> end makkeren — fordi du “burde” bidrage mere til udfaldet.
      </p>
      <p style={{ color: theme.textMid }}>
        Det gør ratingen mere retvisende, når folk <strong style={{ color: theme.text }}>skifter makker</strong>, og det mindsker effekten af meget skæve par på
        banen (ét højt og ét lavt niveau).
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Selve point-ændringen</h2>
      <p style={{ color: theme.textMid }}>
        For hver spiller: <strong style={{ color: theme.text }}>ændring ≈ K × (resultat − forventet score) × sejrsmargin-faktor</strong>, hvor resultat er 1 ved sejr og 0 ved
        tab. K og margin er beskrevet nedenfor — de er <strong style={{ color: theme.text }}>fælles ramme</strong> for kampen, men forventningen <strong style={{ color: theme.text }}>E</strong> er individuel.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>K-faktor (hvor meget må én kamp flytte dig?)</h2>
      <p style={{ color: theme.textMid }}>
        K styrer, <strong style={{ color: theme.text }}>hvor store</strong> tallene bliver, når I vinder eller taber — før sejrsmargin
        ganges på. Den er ikke den samme for alle kampe: den afhænger af <strong style={{ color: theme.text }}>jeres hold</strong> og{' '}
        <strong style={{ color: theme.text }}>modstanderholdet</strong> hver for sig.
      </p>
      <p style={{ color: theme.textMid }}>
        <strong style={{ color: theme.text }}>Trin 1 — pr. hold:</strong> Vi finder den af jer to makkere, der har{' '}
        <strong style={{ color: theme.text }}>færrest</strong> allerede spillede, ratede kampe <strong style={{ color: theme.text }}>før</strong> denne kamp (tallet på profilen “kampe”). Har den person under{' '}
        <strong style={{ color: theme.text }}>10</strong> kampe, får <strong style={{ color: theme.text }}>det hold</strong> en
        “høj” K-værdi på <strong style={{ color: theme.text }}>40</strong>. Ellers får holdet <strong style={{ color: theme.text }}>24</strong>.
        Det samme gøres for modstanderholdet — helt uafhængigt af jer.
      </p>
      <p style={{ color: theme.textMid }}>
        <strong style={{ color: theme.text }}>Trin 2 — hele kampen:</strong> Den K, der bruges i formlen, er{' '}
        <strong style={{ color: theme.text }}>gennemsnittet</strong> af de to holds K-værdier (afrundet til heltal i systembeskeder).
      </p>
      <ul style={{ margin: '12px 0 0', paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '6px' }}>
          Begge hold “nye” (færrest kampe på hvert hold er under 10): 40 og 40 →{' '}
          <strong style={{ color: theme.text }}>effektiv K ≈ 40</strong>.
        </li>
        <li style={{ marginBottom: '6px' }}>
          Begge hold erfarne (min. kampe ≥ 10 på begge hold): 24 og 24 → <strong style={{ color: theme.text }}>effektiv K = 24</strong>.
        </li>
        <li style={{ marginBottom: '6px' }}>
          Ét hold nyt, ét erfarent: 40 og 24 → <strong style={{ color: theme.text }}>effektiv K = 32</strong> — begge hold påvirkes
          ens, men ikke så ekstremt som hvis hele banen var “ny”.
        </li>
      </ul>
      <p style={{ color: theme.textMid, marginTop: '14px' }}>
        <strong style={{ color: theme.text }}>Hvorfor?</strong> Tidligere kunne én meget ny spiller på <em>enten</em> side løfte K for
        alle fire. Nu bestemmer <strong style={{ color: theme.text }}>dit eget holds mindst erfarne</strong> makker jeres holds bidrag,
        og modstandernes bidrag lægges sammen som gennemsnit — det gør det sværere at misbruge ved at “smide en ny ind” kun for at pumpe
        sving for modstandere.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Sejrsmargin (partier på tværs af sæt)</h2>
      <p style={{ color: theme.textMid }}>
        Ud over vinder/tab justerer vi ændringen med <strong style={{ color: theme.text }}>hvor klart</strong> kampen blev vundet
        målt på <strong style={{ color: theme.text }}>samlet antal partier</strong> for holdene over de sæt, der er registreret (ét
        eller tre sæt — tomme sæt tæller ikke med):
      </p>
      <ul style={{ margin: '12px 0 0', paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '6px' }}>
          Lille forskel i partier (margin 0–4): ingen ekstra skalering (×1,00).
        </li>
        <li style={{ marginBottom: '6px' }}>Margin 5–9: ×1,12</li>
        <li style={{ marginBottom: '6px' }}>Margin 10–14: ×1,24</li>
        <li style={{ marginBottom: '6px' }}>Margin 15+: ×1,35</li>
      </ul>
      <p style={{ color: theme.textMid, marginTop: '12px' }}>
        <strong style={{ color: theme.text }}>Eksempel:</strong> Tæt kamp 6-4, 6-4 giver typisk lille margin; en klar 6-0, 6-0 giver
        højere margin og dermed lidt større ELO-sving for vinder og taber.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Americano og ELO</h2>
      <p style={{ color: theme.textMid }}>
        <strong style={{ color: theme.text }}>Americano</strong> har egen statistik på profilen og påvirker ikke ELO. Kun almindelige
        2v2-kampe med bekræftet resultat tæller.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Startværdi og minimum</h2>
      <p style={{ color: theme.textMid }}>
        Nye profiler starter typisk omkring 1000 ELO. Ratingen kan ikke falde under 100 i systemet.
      </p>

      <p style={{ marginTop: '28px', marginBottom: 0, fontSize: '14px', color: theme.textLight }}>
        <Link to="/faq" style={{ color: theme.accent, fontWeight: 600 }}>
          ← Tilbage til FAQ
        </Link>
      </p>
    </LegalPageLayout>
  );
}

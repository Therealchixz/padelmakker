import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function EloExplainerPage() {
  return (
    <LegalPageLayout title="Sadan virker ELO pa PadelMakker">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        ELO er et ratingsystem, der afspejler dit niveau ud fra resultater mod andre spillere. Her er, hvordan vi bruger det i 2v2
        padel.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Hvornar opdateres min rating?</h2>
      <p style={{ color: theme.textMid }}>
        Nar en kamp er <strong style={{ color: theme.text }}>afsluttet</strong> og <strong style={{ color: theme.text }}>bekraftet af modstanderholdet</strong>,
        opdateres hver spillers ELO. Du og din makker kan derfor fa forskellige plus/minus i samme kamp.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Individuel forventning (dig mod deres holdsnit)</h2>
      <p style={{ color: theme.textMid }}>
        Din forventede score beregnes mod <strong style={{ color: theme.text }}>modstanderholdets gennemsnitlige rating</strong>. Det betyder, at spillere med
        forskellig rating pa samme hold far hver deres forventning og derfor ofte hver deres ELO-andring.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Selve andringen</h2>
      <p style={{ color: theme.textMid }}>
        For hver spiller: <strong style={{ color: theme.text }}>andring ~= K x (resultat - forventet score) x sejrsmargin-faktor</strong>.
        Resultat er 1 ved sejr og 0 ved nederlag.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>K-faktor (action-pakken)</h2>
      <p style={{ color: theme.textMid }}>
        K bestemmes <strong style={{ color: theme.text }}>pr. spiller</strong> ud fra egne spillede kampe for den almindelige 2v2-ELO:
      </p>
      <ul style={{ margin: '12px 0 0', paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '6px' }}>
          0-9 kampe: <strong style={{ color: theme.text }}>K = 56</strong>
        </li>
        <li style={{ marginBottom: '6px' }}>
          10-29 kampe: <strong style={{ color: theme.text }}>K = 44</strong>
        </li>
        <li style={{ marginBottom: '6px' }}>
          30+ kampe: <strong style={{ color: theme.text }}>K = 32</strong>
        </li>
      </ul>
      <p style={{ color: theme.textMid, marginTop: '12px' }}>
        Det giver storre bevagelser tidligt og mere stabil rating, nar du har spillet mange kampe.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Sejrsmargin (partier pa tvaers af saet)</h2>
      <p style={{ color: theme.textMid }}>
        Ud over vinder/tab bruges en margin-faktor baseret pa samlet forskel i antal partier:
      </p>
      <ul style={{ margin: '12px 0 0', paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '6px' }}>Margin 0-4: x1.00</li>
        <li style={{ marginBottom: '6px' }}>Margin 5-9: x1.20</li>
        <li style={{ marginBottom: '6px' }}>Margin 10-14: x1.40</li>
        <li style={{ marginBottom: '6px' }}>Margin 15+: x1.60</li>
      </ul>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Zero-sum og minimum</h2>
      <p style={{ color: theme.textMid }}>
        Systemet justerer afrunding, sa kampen samlet set giver cirka 0 i total ELO pa tvrs af de fire spillere. Nye profiler starter
        omkring 1000 ELO, og rating kan ikke falde under 100.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Americano og ELO</h2>
      <p style={{ color: theme.textMid }}>
        Americano bruger et separat ratingspor og pavirker ikke din almindelige 2v2-ELO.
      </p>

      <p style={{ marginTop: '28px', marginBottom: 0, fontSize: '14px', color: theme.textLight }}>
        <Link to="/faq" style={{ color: theme.accent, fontWeight: 600 }}>
          {'<- '}Tilbage til FAQ
        </Link>
      </p>
    </LegalPageLayout>
  );
}

import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme, displayFont } from '../lib/platformTheme';
import { landingEloScoreExample as ex } from '../lib/landingEloExplainer';

const strong = { color: theme.text };
const h2 = { fontFamily: displayFont, fontSize: '19px', fontWeight: 700, color: theme.text, margin: '28px 0 10px' };

/**
 * ELO forklaret: først et eksempel og den korte version i almindeligt dansk,
 * derefter hele udregningen for dem, der vil have detaljerne.
 */
export function EloExplainerPage() {
  return (
    <LegalPageLayout title="Sådan virker ELO på PadelMakker" showUpdated={false} showSignupCta>
      <p style={{ marginTop: 0, color: theme.textMid }}>
        ELO er din rating. Den viser dit niveau ud fra dine resultater, så du kan finde kampe, der er jævnbyrdige.
      </p>

      <figure
        style={{
          margin: '20px 0 0',
          padding: '16px 18px',
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          background: theme.surfaceAlt,
        }}
      >
        <figcaption style={{ fontSize: '13px', fontWeight: 700, color: theme.textLight, marginBottom: '8px' }}>Eksempel</figcaption>
        <p style={{ margin: 0, color: theme.textMid, lineHeight: 1.6 }}>
          {ex.playerName} har <strong style={strong}>{ex.oldElo} ELO</strong>. Han og hans makker vinder{' '}
          <strong style={strong}>{ex.result.replace(/^Vundet /, '')}</strong> mod et hold, der er lidt stærkere end dem. Modstanderne
          bekræfter resultatet, og {ex.playerName} får <strong style={{ color: 'var(--pm-orange)' }}>+{ex.delta}</strong>, så
          han nu har <strong style={strong}>{ex.newElo} ELO</strong>.
        </p>
      </figure>

      <h2 style={h2}>Kort fortalt</h2>
      <ul>
        <li style={{ marginBottom: '8px' }}>Vinder du, går din rating op. Taber du, går den ned.</li>
        <li style={{ marginBottom: '8px' }}>Slår du et stærkere hold, får du flere point. Taber du til et svagere hold, mister du flere.</li>
        <li style={{ marginBottom: '8px' }}>En stor sejr giver lidt mere end en tæt sejr.</li>
        <li style={{ marginBottom: '8px' }}>Ratingen ændres først, når modstanderholdet har bekræftet resultatet.</li>
        <li style={{ marginBottom: '8px' }}>Nye spillere starter omkring 1000 og flytter sig hurtigere i starten.</li>
        <li>Americano og Mexicano har deres egen Turnerings-ELO, som ikke påvirker din 2v2-ELO.</li>
      </ul>

      <h2 style={h2}>Hele udregningen</h2>
      <p style={{ color: theme.textMid }}>For dig, der vil vide præcis, hvordan tallene bliver regnet ud.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>Din forventning</h3>
      <p style={{ color: theme.textMid }}>
        Før kampen beregnes, hvor sandsynligt det er, at du vinder, ud fra din egen rating mod{' '}
        <strong style={strong}>modstanderholdets gennemsnit</strong>. Derfor kan du og din makker få forskellige point i samme kamp.
      </p>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>Selve ændringen</h3>
      <p style={{ color: theme.textMid }}>
        For hver spiller: <strong style={strong}>ændring ≈ K × (resultat − forventning) × sejrsmargin</strong>. Resultat er 1 ved
        sejr og 0 ved nederlag.
      </p>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>K: hvor meget én kamp kan flytte</h3>
      <p style={{ color: theme.textMid }}>K afhænger af, hvor mange kampe du har spillet:</p>
      <ul>
        <li style={{ marginBottom: '6px' }}>0–9 kampe: <strong style={strong}>K = 56</strong></li>
        <li style={{ marginBottom: '6px' }}>10–29 kampe: <strong style={strong}>K = 44</strong></li>
        <li>30+ kampe: <strong style={strong}>K = 32</strong></li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>Sejrsmargin</h3>
      <p style={{ color: theme.textMid }}>Forskellen i vundne partier over alle sæt giver et lille tillæg:</p>
      <ul>
        <li style={{ marginBottom: '6px' }}>0–4 partier: × 1,00</li>
        <li style={{ marginBottom: '6px' }}>5–9 partier: × 1,20</li>
        <li style={{ marginBottom: '6px' }}>10–14 partier: × 1,40</li>
        <li>15+ partier: × 1,60</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>Balance og bundgrænse</h3>
      <p style={{ color: theme.textMid }}>
        Point flyttes mellem spillerne, så de fire i en kamp tilsammen hverken får eller mister point (på nær afrunding). Nye profiler
        starter omkring 1000, og ingen kan komme under 100.
      </p>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.text, margin: '20px 0 8px' }}>Turnerings-ELO</h3>
      <p style={{ color: theme.textMid }}>
        Når en Americano eller Mexicano er færdig, beregnes Turnerings-ELO ud fra slutstillingen (de samlede point), og ændringen
        gemmes i din turneringshistorik.
      </p>

      <p style={{ marginTop: '28px', marginBottom: 0, fontSize: '14px' }}>
        <Link to="/faq" style={{ color: theme.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>
          ← Tilbage til FAQ
        </Link>
      </p>
    </LegalPageLayout>
  );
}

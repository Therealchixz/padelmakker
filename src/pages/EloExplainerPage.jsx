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
        <strong style={{ color: theme.text }}>begge hold har bekræftet resultatet</strong>, beregner systemet én ELO-ændring for hele
        kampen. Alle fire spillere på holdene får <strong style={{ color: theme.text }}>samme</strong> point-tilvækst eller -tab som
        deres makker på holdet (vi bruger <strong style={{ color: theme.text }}>gennemsnitlig rating</strong> pr. hold til forventet
        udfald).
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Forventet resultat</h2>
      <p style={{ color: theme.textMid }}>
        Jo højere modstandernes hold er rated sammenlignet med jeres, jo mere “forventer” systemet, at I taber. Vinder I alligevel,
        stiger I mere. Taber I til et svagere hold ifølge ratingen, falder I mere. Ved **lige stærke hold** er forventningen tæt på
        fifty-fifty — så giver sejr og nederlag omtrent **samme størrelse** ændring (før margin, se nedenfor).
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>K-faktor (hvor meget må én kamp flytte dig?)</h2>
      <p style={{ color: theme.textMid }}>
        Vi bruger en dynamisk K: hvis <strong style={{ color: theme.text }}>mindst én</strong> af de fire spillere har under{' '}
        <strong style={{ color: theme.text }}>15</strong> registrerede kampe <strong style={{ color: theme.text }}>før</strong> denne
        kamp, er <strong style={{ color: theme.text }}>K = 40</strong> (ratingen må bevæge sig lidt hurtigere, mens man er ny). Ellers
        er <strong style={{ color: theme.text }}>K = 24</strong>.
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

import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function CookiesPage() {
  return (
    <LegalPageLayout title="Cookies og lokal lagring">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        Her beskriver vi kort, hvordan PadelMakker bruger cookies og browser-lagring. Vi bruger ikke marketing-cookies fra tredjeparter
        i standardopsætningen af denne app — men tilføj her, hvis I senere aktiverer fx Vercel Analytics, Google eller Facebook.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Nødvendige tekniske cookies</h2>
      <p style={{ color: theme.textMid }}>
        Login og sikker session hos Supabase kan kræve cookies eller tilsvarende lagring i browseren, så du forbliver logget ind og
        så serveren kan beskytte mod misbrug. Uden dette virker appen ikke som forventet.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Lokal lagring (localStorage)</h2>
      <p style={{ color: theme.textMid }}>
        Vi kan gemme små præferencer på din enhed (fx at du har set cookie-informationen), så du ikke bliver spurgt hver gang du
        besøger siden.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Service worker (PWA)</h2>
      <p style={{ color: theme.textMid }}>
        Som progressiv webapp kan en service worker cache indhold for hurtigere indlæsning og offline-adfærd. Den indeholder ikke
        dine personlige data som standard.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Tredjeparter</h2>
      <p style={{ color: theme.textMid }}>
        Supabase og hosting-leverandør kan sætte eller behandle tekniske cookies i forbindelse med deres SDK og infrastruktur. Se
        også vores{' '}
        <Link to="/privatlivspolitik" style={{ color: theme.accent, fontWeight: 600 }}>
          privatlivspolitik
        </Link>
        .
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' }}>Kontrol i browseren</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Du kan slette cookies og lokal lagring i dine browserindstillinger. Bemærk, at du så typisk bliver logget ud eller mister
        lokale indstillinger i appen.
      </p>
    </LegalPageLayout>
  );
}

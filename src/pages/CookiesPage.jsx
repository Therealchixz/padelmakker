import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

const h2 = { fontSize: '17px', fontWeight: 700, color: theme.text, margin: '24px 0 12px' };
const p = { color: theme.textMid };
const li = { marginBottom: '8px' };

const tourVideoEnabled = Boolean(String(import.meta.env.VITE_LANDING_TOUR_VIDEO_ID || '').trim());

export function CookiesPage() {
  return (
    <LegalPageLayout title="Cookies og lokal lagring">
      <p style={{ marginTop: 0, ...p }}>
        PadelMakker bruger primært teknisk nødvendig lagring, så appen kan logge dig ind, huske præferencer og køre
        sikkert. Vi sætter ikke marketing-cookies eller tredjeparts reklamesporing i standardopsætningen.
      </p>

      <h2 style={h2}>Nødvendige cookies og session</h2>
      <p style={p}>
        Login og sikker session hos <strong style={{ color: theme.text }}>Supabase</strong> kan kræve cookies eller
        tilsvarende lagring i browseren (fx under nøglen <code style={{ fontSize: '13px' }}>sb-…-auth-token</code>), så du
        forbliver logget ind, og så serveren kan beskytte mod misbrug. Uden dette virker appen ikke som forventet.
      </p>

      <h2 style={h2}>Sikkerhed (Cloudflare Turnstile)</h2>
      <p style={p}>
        Ved login og oprettelse kan vi vise et sikkerhedscheck fra <strong style={{ color: theme.text }}>Cloudflare
        Turnstile</strong>. Det kan sætte tekniske cookies eller behandle enhedsdata for at vurdere, om forespørgslen er
        legitim.
      </p>

      <h2 style={h2}>Lokal lagring (localStorage)</h2>
      <p style={p}>
        Vi gemmer små præferencer på din enhed, fx at du har set cookie-informationen, tema-valg, afviste notifikationer
        eller midlertidige data under oprettelse. Det er ikke reklameprofiler.
      </p>

      <h2 style={h2}>Service worker (PWA)</h2>
      <p style={p}>
        Som progressiv webapp kan en service worker cache statiske filer for hurtigere indlæsning. Den indeholder ikke dine
        personlige profildata som standard.
      </p>

      <h2 style={h2}>Browser-push</h2>
      <p style={p}>
        Hvis du aktiverer push-notifikationer, gemmer browseren et teknisk push-abonnement, som vores servere bruger til
        at sende beskeder. Du kan fjerne tilladelsen i browser- eller enhedsindstillinger.
      </p>

      {tourVideoEnabled && (
        <>
          <h2 style={h2}>Video på forsiden (YouTube)</h2>
          <p style={p}>
            Hvis vi viser en introduktionsvideo indlejret fra YouTube (<code style={{ fontSize: '13px' }}>youtube-nocookie.com</code>),
            kan YouTube/Google sætte cookies eller modtage tekniske data (fx IP), når du afspiller videoen. Videoen indlæses
            først, når du interagerer med afspilleren.
          </p>
        </>
      )}

      <h2 style={h2}>Google-login</h2>
      <p style={p}>
        Vælger du “Log ind med Google”, kan Google behandle cookies og data efter deres egne regler på deres domæne, før
        du vender tilbage til PadelMakker.
      </p>

      <h2 style={h2}>Hosting og tredjeparter</h2>
      <p style={p}>
        <strong style={{ color: theme.text }}>Supabase</strong> og <strong style={{ color: theme.text }}>Vercel</strong> kan
        behandle tekniske cookies eller logs i forbindelse med deres infrastruktur. Se også vores{' '}
        <Link to="/privatlivspolitik" style={{ color: theme.accent, fontWeight: 600 }}>
          privatlivspolitik
        </Link>
        .
      </p>

      <h2 style={h2}>Kontrol i browseren</h2>
      <p style={{ marginBottom: 0, ...p }}>
        Du kan slette cookies og lokal lagring i dine browserindstillinger. Bemærk, at du så typisk bliver logget ud eller
        mister lokale indstillinger i appen.
      </p>
    </LegalPageLayout>
  );
}

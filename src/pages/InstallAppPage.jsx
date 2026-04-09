import { LegalPageLayout } from '../components/LegalPageLayout';
import { theme } from '../lib/platformTheme';

export function InstallAppPage() {
  return (
    <LegalPageLayout title="Installér PadelMakker på telefonen">
      <p style={{ marginTop: 0, color: theme.textMid }}>
        PadelMakker er en <strong style={{ color: theme.text }}>progressiv webapp (PWA)</strong>. Du behøver ikke App Store
        eller Google Play — du tilføjer siden til hjemmeskærmen og åbner den som en almindelig app.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>iPhone og iPad (Safari)</h2>
      <ol style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '8px' }}>Åbn <strong style={{ color: theme.text }}>padelmakker.dk</strong> i Safari (ikke Chrome på iOS til “Tilføj til hjem”).</li>
        <li style={{ marginBottom: '8px' }}>Tryk på <strong style={{ color: theme.text }}>knappen Del</strong> (firkanter med pil op).</li>
        <li style={{ marginBottom: '8px' }}>Rul ned og vælg <strong style={{ color: theme.text }}>“Føj til hjemmeskærm”</strong> / <strong>“Add to Home Screen”</strong>.</li>
        <li style={{ marginBottom: '8px' }}>Bekræft navnet (fx “PadelMakker”) og tryk <strong style={{ color: theme.text }}>Tilføj</strong>.</li>
      </ol>
      <p style={{ fontSize: '14px', color: theme.textLight, marginTop: '12px' }}>
        Ikonet ligger på hjemmeskærmen; åbn det som enhver anden app. Du forbliver logget ind som i browseren.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Android (Chrome)</h2>
      <ol style={{ margin: 0, paddingLeft: '1.25rem', color: theme.textMid, lineHeight: 1.65 }}>
        <li style={{ marginBottom: '8px' }}>Åbn <strong style={{ color: theme.text }}>padelmakker.dk</strong> i Chrome.</li>
        <li style={{ marginBottom: '8px' }}>
          Tryk på <strong style={{ color: theme.text }}>⋮</strong> (menu) og vælg{' '}
          <strong style={{ color: theme.text }}>“Føj til startskærm”</strong>,{' '}
          <strong style={{ color: theme.text }}>“Installer app”</strong> eller tilsvarende — formuleringen kan variere efter
          telefon og Chrome-version.
        </li>
        <li style={{ marginBottom: '8px' }}>Bekræft installationen.</li>
      </ol>
      <p style={{ fontSize: '14px', color: theme.textLight, marginTop: '12px' }}>
        Nogle enheder viser også en lille banner eller et install-ikon i adresselinjen, når siden understøtter PWA.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Computer (Chrome, Edge)</h2>
      <p style={{ color: theme.textMid }}>
        I Chrome eller Edge kan der vises et <strong style={{ color: theme.text }}>install-ikon</strong> i adresselinjen eller
        under menuen “Installer PadelMakker”. Så åbnes siden i et eget vindue uden browserknapper — praktisk hvis du ofte
        bruger platformen fra PC.
      </p>

      <h2 style={{ fontSize: '17px', fontWeight: 700, color: theme.text, margin: '28px 0 12px' }}>Opdateringer</h2>
      <p style={{ marginBottom: 0, color: theme.textMid }}>
        Når vi udgiver en ny version, opdateres appen automatisk næste gang du åbner den (med netforbindelse). Du behøver
        ikke hente opdateringer fra en butik.
      </p>
    </LegalPageLayout>
  );
}

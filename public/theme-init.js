try {
  var t = localStorage.getItem('pm-theme')
  // Intet eget valg endnu: følg enhedens lys/mørk-indstilling.
  if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'
  if (t) document.documentElement.setAttribute('data-theme', t)
  // Statusbjaelken foelger lys/moerk; forsiden (/) er altid moerk.
  var tc = document.querySelector('meta[name="theme-color"]')
  if (tc) tc.setAttribute('content', location.pathname === '/' ? '#1B1A17' : (t === 'dark' ? '#141311' : '#F3EEE4'))
} catch {
  // Ignore storage errors in private/incognito contexts.
}

// Skrifttyperne (Instrument Sans, Anton, IBM Plex Mono): index.html forhånds-henter den som "preload". Før blev den
// gjort til et stylesheet med onload="..." direkte i HTML'en, men sidens
// sikkerhedsregel (CSP) forbyder kode i HTML-attributter, så Inter blev aldrig
// brugt, og alle så systemskriften (QA 14. okt. 2026). Her, i en fil, er det tilladt.
try {
  var fontLinks = document.querySelectorAll('link[data-critical-font]')
  for (var i = 0; i < fontLinks.length; i++) fontLinks[i].rel = 'stylesheet'
} catch {
  // Uden dem falder siden tilbage til systemskriften.
}

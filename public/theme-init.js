try {
  var t = localStorage.getItem('pm-theme')
  if (t) document.documentElement.setAttribute('data-theme', t)
} catch {
  // Ignore storage errors in private/incognito contexts.
}

// Skrifttypen Inter: index.html forhånds-henter den som "preload". Før blev den
// gjort til et stylesheet med onload="..." direkte i HTML'en, men sidens
// sikkerhedsregel (CSP) forbyder kode i HTML-attributter, så Inter blev aldrig
// brugt, og alle så systemskriften (QA 14. okt. 2026). Her, i en fil, er det tilladt.
try {
  var fontLinks = document.querySelectorAll('link[data-critical-font]')
  for (var i = 0; i < fontLinks.length; i++) fontLinks[i].rel = 'stylesheet'
} catch {
  // Uden Inter falder siden tilbage til systemskriften.
}

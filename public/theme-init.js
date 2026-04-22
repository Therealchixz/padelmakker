try {
  var t = localStorage.getItem('pm-theme')
  if (t) document.documentElement.setAttribute('data-theme', t)
} catch {
  // Ignore storage errors in private/incognito contexts.
}

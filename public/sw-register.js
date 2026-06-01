if ('serviceWorker' in navigator) {
  // Når en ny service worker overtager (efter et deploy), genindlæs siden
  // én gang så de friske bundles hentes. Guarden forhindrer reload-loop.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Tjek aktivt efter en nyere service worker ved hver app-start.
      reg.update?.().catch(() => {});
    }).catch(() => {});
  });
}

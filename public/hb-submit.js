(function () {
  var form = document.getElementById('pm-hb-padel');
  if (!form) return;
  try {
    form.submit();
  } catch (e) {
    /* CSP eller browser blokerer — brug knappen "Fortsæt til booking" */
  }
})();

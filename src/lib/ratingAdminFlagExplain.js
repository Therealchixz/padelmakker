function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatSignedNumber(value) {
  const num = toFiniteNumber(value);
  if (num == null) return 'ukendt';
  if (num > 0) return `+${num}`;
  return String(num);
}

function formatReasonFallback(reason) {
  const raw = String(reason || '').trim();
  if (!raw) return 'Ukendt flag';
  if (raw.startsWith('[DEMO]')) return raw;
  return raw.replace(/_/g, ' ');
}

export function explainRatingAdminFlag(flag) {
  const reason = String(flag?.reason || '').trim();
  const payload = flag?.payload && typeof flag.payload === 'object' ? flag.payload : {};

  if (reason === 'repeated_quartet_high_volume_14d') {
    const count = toFiniteNumber(payload.same_quartet_14d);
    const days = toFiniteNumber(payload.window_days) ?? 14;
    return {
      title: 'Samme 4 spillere møder hinanden meget ofte',
      description:
        count != null
          ? `Systemet har registreret ${count} kampe med den samme spillergruppe inden for ${days} dage.`
          : `Systemet har registreret usædvanligt mange kampe med den samme spillergruppe inden for ${days} dage.`,
      suggestion:
        'Tjek kamphistorikken for de 4 spillere. Hvis mønstret fortsætter, så følg op manuelt og bed dem spille mod flere forskellige modstandere.',
      technicalReason: reason,
    };
  }

  if (reason === 'non_zero_sum_match_delta') {
    const sumChange = formatSignedNumber(payload.sum_change);
    const maxAbs = toFiniteNumber(payload.max_abs_change);
    const minAbs = toFiniteNumber(payload.min_abs_change);
    return {
      title: 'Kampens samlede ELO-ændring er ikke 0',
      description:
        maxAbs != null && minAbs != null
          ? `Summen af ELO-ændringer blev ${sumChange}. Spændet i kampen gik fra ${minAbs} til ${maxAbs} point.`
          : `Summen af ELO-ændringer blev ${sumChange}, men burde normalt lande på 0 for en 2v2-kamp.`,
      suggestion:
        'Kontroller resultat og spilleropstilling for kampen. Brug derefter “Prøv ELO igen” eller lav en manuel justering hvis kampen allerede er bekræftet korrekt.',
      technicalReason: reason,
    };
  }

  if (reason === 'extreme_delta_spread') {
    const maxAbs = toFiniteNumber(payload.max_abs_change);
    const minAbs = toFiniteNumber(payload.min_abs_change);
    return {
      title: 'Meget stor forskel i ELO-ændringer mellem spillerne',
      description:
        maxAbs != null && minAbs != null
          ? `En spiller fik op til ${maxAbs} point, mens en anden kun fik ${minAbs} point i samme kamp.`
          : 'Systemet har fundet en usædvanlig stor forskel i ELO-ændringer i samme kamp.',
      suggestion:
        'Tjek om kampen var korrekt oprettet (hold, score, spillere). Hvis alt er korrekt, kan det være et legitimt udsving, men hold øje med gentagelser.',
      technicalReason: reason,
    };
  }

  return {
    title: formatReasonFallback(reason),
    description: 'Systemet markerede denne hændelse som usædvanlig. Se datafeltet for tekniske detaljer.',
    suggestion: 'Gennemgå kampen/turneringen manuelt og luk flaget, hvis alt ser korrekt ud.',
    technicalReason: reason || 'ukendt',
  };
}


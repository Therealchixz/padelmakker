/**
 * Klassificér MATCHi-facilitet ud fra "Padel INDOORS" / "Padel OUTDOORS" i HTML.
 * @returns {'indoor'|'outdoor'|'both'|'unknown'}
 */
export function classifyMatchiPadelFacility(html) {
  const indoorPadel = /Padel\s+INDOORS/i.test(html);
  const outdoorPadel = /Padel\s+OUTDOORS/i.test(html);
  if (indoorPadel && outdoorPadel) return 'both';
  if (indoorPadel) return 'indoor';
  if (outdoorPadel) return 'outdoor';
  return 'unknown';
}

/** @returns {boolean} */
export function matchiPadelIsPrimarilyIndoor(html) {
  const kind = classifyMatchiPadelFacility(html);
  if (kind === 'indoor') return true;
  if (kind === 'outdoor') return false;
  if (kind === 'both') {
    const indoorCount = (html.match(/Padel\s+INDOORS[\s\S]*?\((\d+)\s*pcs?\)/i) || [])[1];
    const outdoorCount = (html.match(/Padel\s+OUTDOORS[\s\S]*?\((\d+)\s*pcs?\)/i) || [])[1];
    const i = Number(indoorCount) || 0;
    const o = Number(outdoorCount) || 0;
    if (i > 0 && o === 0) return true;
    if (o > 0 && i === 0) return false;
    return i >= o;
  }
  return true;
}

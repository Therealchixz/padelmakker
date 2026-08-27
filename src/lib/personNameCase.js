/**
 * Fornavn/efternavn: første bogstav stort, resten småt.
 * Virker på hele visningsnavnet (mellemrum, bindestreg, apostrof).
 */
export function toPersonNameCase(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw.split(' ').map(titleHyphenWord).join(' ');
}

function titleHyphenWord(word) {
  return word.split('-').map(titleApostrophePart).join('-');
}

function titleApostrophePart(part) {
  return part.split("'").map(titleNameSegment).join("'");
}

function titleNameSegment(seg) {
  if (!seg) return '';
  const chars = Array.from(seg.toLocaleLowerCase('da'));
  chars[0] = chars[0].toLocaleUpperCase('da');
  return chars.join('');
}

/**
 * Danske brugerbeskeder for Twilio Programmable Messaging-fejl (OTP/SMS).
 * Koder fra https://www.twilio.com/docs/api/errors — vedligeholdes med Twilio docs MCP.
 */

/** @type {Record<number, string>} */
const TWILIO_SMS_ERROR_DA = {
  21211:
    'Telefonnummeret ser ugyldigt ud. Brug landekode, fx +45 12 34 56 78.',
  21217: 'Telefonnummeret ser ugyldigt ud. Tjek cifrene og landekoden.',
  21408:
    'SMS til dette land/område er ikke tilladt på Twilio-kontoen. Kontakt support.',
  21607:
    'SMS-afsender er ikke konfigureret korrekt (Twilio trial). Kontakt support.',
  21608:
    'Dette nummer kan ikke modtage SMS på testkontoen. Brug et verificeret nummer eller kontakt os.',
  21610: 'Dette nummer kan ikke modtage SMS (afmeldt).',
  21612: 'SMS kan ikke sendes til dette nummer med den nuværende afsender.',
  21614:
    'Nummeret ser ikke ud til at kunne modtage SMS (fx fastnet). Prøv et mobilnummer.',
  21705: 'SMS-tjenesten er ikke konfigureret korrekt. Kontakt support.',
  20429: 'For mange SMS-forsøg. Vent et øjeblik og prøv igen.',
};

/**
 * @param {number | string | null | undefined} code
 * @param {string} [fallback]
 * @returns {string | null}
 */
export function mapTwilioSmsErrorCode(code, fallback = '') {
  const n = Number(code);
  if (!Number.isFinite(n)) return fallback.trim() || null;
  return TWILIO_SMS_ERROR_DA[n] ?? (fallback.trim() || null);
}

/**
 * Udtræk Twilio-fejlkode fra hook/API-tekst (fx "Twilio fejl: ..." eller "error code 21211").
 * @param {string} message
 * @returns {string | null}
 */
export function mapTwilioSmsErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const codeMatch = raw.match(/\b(21\d{3}|20429)\b/);
  if (codeMatch) {
    const mapped = mapTwilioSmsErrorCode(codeMatch[1]);
    if (mapped) return mapped;
  }

  const lower = raw.toLowerCase();
  if (lower.includes('not a valid mobile') || lower.includes('21614')) {
    return TWILIO_SMS_ERROR_DA[21614];
  }
  if (lower.includes('not yet verified') || lower.includes('21608')) {
    return TWILIO_SMS_ERROR_DA[21608];
  }
  if (lower.includes('invalid') && lower.includes("'to'")) {
    return TWILIO_SMS_ERROR_DA[21211];
  }

  return null;
}

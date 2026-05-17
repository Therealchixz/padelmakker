/** Brugervenlig toast-tekst efter deling. */
export function shareResultToastMessage(result) {
  if (!result?.ok) {
    if (result?.method === 'none' && !result?.error) return null;
    return result?.error || 'Kunne ikke dele lige nu';
  }
  if (result.method === 'clipboard') return 'Link kopieret — send det til dine makkere!';
  return 'Delt!';
}

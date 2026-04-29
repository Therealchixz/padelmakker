export function formatEloSuccessToast(data) {
  const n = Number(data?.players_updated) || 0;
  if (n === 0) {
    return 'ELO blev ikke opdateret for nogen spillere. Tjek at alle fire spillere var med på kampen da resultatet blev gemt.';
  }

  const playerLabel = n === 1 ? 'spiller' : 'spillere';
  return `Resultatet er bekræftet. ELO er opdateret for ${n} ${playerLabel}.`;
}

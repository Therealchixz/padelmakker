/** "Kevin: Er vi klar til i aften?" — tom chat → fallback. */
export function formatMatchChatPreview(msg, currentUserId) {
  if (!msg) return 'Ingen beskeder endnu';
  const mine = currentUserId != null && String(msg.sender_id) === String(currentUserId);
  const name = mine
    ? 'Dig'
    : (String(msg.sender_name || 'Spiller').trim().split(/\s+/)[0] || 'Spiller');
  const text = String(msg.content || '').replace(/\s+/g, ' ').trim();
  if (!text) return `${name} sendte en besked`;
  const clipped = text.length > 52 ? `${text.slice(0, 51)}…` : text;
  return `${name}: ${clipped}`;
}

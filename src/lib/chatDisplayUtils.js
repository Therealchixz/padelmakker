const AVATAR_COLORS = ['#16377E', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0891B2'];

export function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function colorFromId(id = '') {
  return AVATAR_COLORS[hashString(String(id)) % AVATAR_COLORS.length];
}

export function formatInboxTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'i går';
  const dayDiff = Math.floor((now - d) / 86400000);
  if (dayDiff < 7) {
    return d.toLocaleDateString('da-DK', { weekday: 'short' }).replace('.', '');
  }
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export function formatBubbleTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateDivider(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isToday) return 'I dag';
  if (d.toDateString() === yesterday.toDateString()) return 'I går';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

/** Insert { type: 'date', label } markers between messages sorted by createdAt. */
export function withDateDividers(messages, getCreatedAt = (m) => m.createdAt) {
  const out = [];
  let prevDay = null;
  for (const msg of messages) {
    const createdAt = getCreatedAt(msg);
    const dayKey = createdAt ? new Date(createdAt).toDateString() : null;
    if (dayKey && dayKey !== prevDay) {
      out.push({ type: 'date', id: `date-${dayKey}`, label: formatDateDivider(createdAt) });
      prevDay = dayKey;
    }
    out.push(msg);
  }
  return out;
}

export function isSameSender(a, b) {
  if (!a || !b) return false;
  return String(a.from) === String(b.from);
}

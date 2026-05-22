/**
 * Find faktisk booking-URL (MATCHi/Halbooking) fra et centres marketing-side.
 * Kør: node scripts/discover-booking-from-url.mjs <url>
 */
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/discover-booking-from-url.mjs <url>');
  process.exit(1);
}

const html = await fetch(url, {
  headers: { 'User-Agent': 'PadelMakkerBookingDiscover/1.0' },
  redirect: 'follow',
}).then((r) => r.text());

const found = new Set();
for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
  const h = m[1];
  if (/matchi\.se\/facilities\//i.test(h)) found.add(h.split('?')[0]);
  if (/halbooking\.dk\/newlook\/proc_baner/i.test(h)) found.add(h.split('?')[0]);
  if (/halbooking\.dk\/newlook\/default/i.test(h)) found.add(h.replace(/default\.asp.*/, 'proc_baner.asp'));
  if (/bookli\.app/i.test(h)) found.add(h.split('?')[0]);
}

console.log('Source:', url);
if (found.size === 0) {
  console.log('No MATCHi/Halbooking/Bookli booking links found in HTML.');
} else {
  for (const u of found) console.log(' ', u);
}

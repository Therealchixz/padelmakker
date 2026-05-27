const urls = [
  'https://padelzone.halbooking.dk/newlook/proc_baner.asp',
  'https://midtmors-sport.halbooking.dk/newlook/proc_baner.asp',
];
for (const u of urls) {
  const h = await fetch(u, { headers: { 'User-Agent': 'T/1' } }).then((r) => r.text());
  console.log('\n', u);
  console.log('  soeg_omraede', h.includes('soeg_omraede'), 'owl', h.includes('owl-kalender'), '# Padel', /# Padel/i.test(h));
}

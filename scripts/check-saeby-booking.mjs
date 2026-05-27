const urls = [
  'https://sfc.dk/faciliteter-sport/padel-tennis/',
  'https://sfc.dk/',
];
for (const url of urls) {
  try {
    const t = await fetch(url, { headers: { 'User-Agent': 'PadelMakker/1' }, signal: AbortSignal.timeout(15000) }).then((r) =>
      r.text()
    );
    console.log('\n', url);
    console.log('  halbooking:', /halbooking/i.test(t));
    console.log('  sportshallen:', /sportshallen/i.test(t));
    const hrefs = [...t.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]).filter((h) => /book|hal|padel|sport/i.test(h));
    console.log('  links:', [...new Set(hrefs)].slice(0, 12));
  } catch (e) {
    console.log(url, e.message);
  }
}

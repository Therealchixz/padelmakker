import { fetchBookliTimelineForDate } from '../padelmakker-server/bookliTimeline.js';

const UA = 'PadelMakkerProbe/1.0';
const urls = [
  'https://padelclub.dk/l/munkebo',
  'https://padelclubringsted.dk/',
  'https://padelclub.dk/roskilde/',
  'https://www.odderpadelcenter.dk/',
  'https://padelclub.dk/koge',
  'https://padelclub.dk/soenderborg',
  'https://padelclub.dk/tonder',
  'https://padelclub.dk/toender',
  'https://padeltoender.dk/',
  'https://padelclub.dk/l/koge',
  'https://bookli.app/go/location/cl6kkzj108249110ds68hhwggm8',
];

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });

for (const url of urls) {
  console.log('\n===', url);
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }).then((r) =>
      r.text()
    );
    const ids = [...new Set([...html.matchAll(/\bck[a-z0-9]{20,}\b/gi)].map((m) => m[0]))];
    console.log('ck ids', ids.slice(0, 12));
    for (const loc of ids.slice(0, 6)) {
      const cats = await fetch('https://api.bookli.app/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          query: `query { resourceCategories(isPublic: true, locationId: "${loc}") { data { id name } } }`,
        }),
      }).then((r) => r.json());
      const data = cats?.data?.resourceCategories?.data || [];
      const padel = data.find((c) => /padel/i.test(c.name));
      if (!padel && !data.length) continue;
      const catId = padel?.id || data[0]?.id;
      const r = await fetchBookliTimelineForDate(today, {
        locationId: loc,
        resourceCategoryId: catId,
        timezone: 'Europe/Copenhagen',
      });
      const courts = r.courts?.length || 0;
      if (courts > 0) {
        console.log('  OK location', loc, 'cat', catId, padel?.name, 'courts', courts);
      }
    }
  } catch (e) {
    console.log('  err', e.message);
  }
}

const UA = 'PadelMakkerDiscovery/1.0';
const html = await fetch('https://www.matchi.se/facilities/index?lang=da', { headers: { 'User-Agent': UA } }).then(
  (r) => r.text()
);
const block = html.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const opts = [...block.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map((m) => ({
  id: m[1],
  label: m[2].trim(),
}));
for (const q of ['Brønderslev', 'Aarhus', 'København', 'Frederikshavn']) {
  const o = opts.find((x) => x.label.includes(q));
  console.log(q, o);
  if (!o) continue;
  const body = new FormData();
  body.append('sport', '5');
  body.append('municipality', o.id);
  body.append('asJson', 'true');
  const res = await fetch('https://www.matchi.se/facilities/findFacilities', {
    method: 'POST',
    headers: { 'User-Agent': UA },
    body,
  });
  const text = await res.text();
  const isJson = text.trimStart().startsWith('{');
  if (isJson) {
    const data = JSON.parse(text);
    console.log(
      '  json',
      'facilities',
      data.facilities?.length,
      'rest',
      data.restOfFacilities?.length,
      (data.facilities || []).map((f) => `${f.shortname}/${f.city}`)
    );
  } else {
    const links = [...text.matchAll(/facilities\/([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    const uniq = [...new Set(links)].filter((s) => s !== 'index' && s !== 'findFacilities');
    console.log('  html facilities', uniq.length, uniq.slice(0, 8));
  }
}

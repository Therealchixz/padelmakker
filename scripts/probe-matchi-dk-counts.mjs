const UA = 'PadelMakkerDiscovery/1.0';
const DK = ['Brønderslev', 'Aarhus', 'Odense', 'Slagelse', 'Vejle', 'København', 'Frederikshavn', 'Hedensted', 'Viborg', 'Esbjerg'];
const html = await fetch('https://www.matchi.se/facilities/index?lang=da', { headers: { 'User-Agent': UA } }).then((r) =>
  r.text()
);
const block = html.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const opts = [...block.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map((m) => ({
  id: m[1],
  label: m[2].trim().replace(/\s*\(\d+\)\s*$/, ''),
}));

for (const name of DK) {
  const o = opts.find((x) => x.label === name);
  if (!o) {
    console.log(name, 'NOT FOUND');
    continue;
  }
  const body = new FormData();
  body.append('sport', '5');
  body.append('municipality', o.id);
  body.append('asJson', 'true');
  const data = await fetch('https://www.matchi.se/facilities/findFacilities', {
    method: 'POST',
    headers: { 'User-Agent': UA },
    body,
  }).then((r) => r.json());
  console.log(name, o.id, (data.facilities || []).length, (data.facilities || []).map((f) => f.shortname).join(', '));
  await new Promise((r) => setTimeout(r, 100));
}

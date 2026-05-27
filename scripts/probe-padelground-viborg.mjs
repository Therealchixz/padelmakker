const slug = 'PadelgroundViborg';
const url = `https://www.matchi.se/facilities/${slug}`;
const html = await fetch(url, { headers: { 'User-Agent': 'PadelMakker/1' } }).then((r) => r.text());
const m = html.match(/facilityId[=:"'](\d+)/);
console.log('facilityId', m?.[1]);
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
if (m?.[1]) {
  const sched = `https://www.matchi.se/book/schedule?facilityId=${m[1]}&date=${today}&sport=5&week=&year=`;
  const sh = await fetch(sched, { headers: { 'User-Agent': 'PadelMakker/1' } }).then((r) => r.text());
  console.log('schedule courts', (sh.match(/class="court"/gi) || []).length);
}

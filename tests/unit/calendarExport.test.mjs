import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';

import { buildCalendarIcsUrl, buildGoogleCalendarUrl } from '../../src/lib/calendarExport.js';
import { buildIcsFromQuery, handleCalendarIcs } from '../../padelmakker-server/routes/calendarIcs.js';

test('openCalendarInvite bruger HTTPS .ics og ikke share-sheet eller data-URL', () => {
  const src = readFileSync('src/lib/calendarExport.js', 'utf8');
  assert.match(src, /\/kamp\.ics/);
  assert.match(src, /location\.assign/);
  assert.doesNotMatch(src, /data:text\/calendar/);
  assert.doesNotMatch(src, /navigator\.share/);
  assert.doesNotMatch(src, /canShare/);
});

test('buildCalendarIcsUrl laver et .ics-endpoint med UTC-tider', () => {
  const start = DateTime.fromISO('2026-08-27T18:00:00', { zone: 'Europe/Copenhagen' });
  const end = start.plus({ minutes: 90 });
  const url = buildCalendarIcsUrl({
    uid: 'match-abc@padelmakker.dk',
    title: 'Padelkamp',
    start,
    end,
    location: 'PadelPadel Aarhus',
    description: 'Social kamp',
    url: 'https://www.padelmakker.dk/dashboard/kampe/2v2/abc',
  });
  assert.match(url, /^\/kamp\.ics\?/);
  assert.match(url, /start=20260827T160000Z/);
  assert.match(url, /end=20260827T173000Z/);
  assert.match(url, /Padelkamp/);
});

test('buildGoogleCalendarUrl laver et Google TEMPLATE-link', () => {
  const start = DateTime.fromISO('2026-08-27T18:00:00', { zone: 'Europe/Copenhagen' });
  const end = start.plus({ minutes: 90 });
  const url = buildGoogleCalendarUrl({
    title: 'Padelkamp',
    start,
    end,
    location: 'PadelPadel Aarhus',
    description: 'Social kamp',
  });
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  assert.match(url, /action=TEMPLATE/);
  assert.match(url, /Padelkamp/);
  assert.match(url, /20260827T160000Z/);
});

test('buildIcsFromQuery afviser ugyldige tider', () => {
  assert.equal(buildIcsFromQuery(new URLSearchParams('start=nope&end=20260827T173000Z')), null);
});

test('calendar.ics endpoint returnerer inline text/calendar', () => {
  const headers = {};
  let body = '';
  const req = {
    method: 'GET',
    url: '/api/calendar.ics?uid=match-abc@padelmakker.dk&title=Padelkamp&start=20260827T160000Z&end=20260827T173000Z&location=Aarhus',
  };
  const res = {
    statusCode: 0,
    setHeader(key, value) {
      headers[String(key).toLowerCase()] = value;
    },
    end(chunk) {
      body = String(chunk || '');
    },
  };
  handleCalendarIcs(req, res);
  assert.equal(res.statusCode, 200);
  assert.match(headers['content-type'], /text\/calendar/);
  assert.match(headers['content-disposition'], /inline/);
  assert.match(headers['content-disposition'], /padelkamp\.ics/);
  assert.match(body, /BEGIN:VCALENDAR/);
  assert.match(body, /SUMMARY:Padelkamp/);
  assert.match(body, /DTSTART:20260827T160000Z/);
  assert.match(body, /LOCATION:Aarhus/);
});

test('Vercel rewriter /kamp.ics til kalender-API', () => {
  const vercel = readFileSync('vercel.json', 'utf8');
  assert.match(vercel, /"source": "\/kamp\.ics"/);
  assert.match(vercel, /"destination": "\/api\/calendar"/);
  const api = readFileSync('api/[slug].js', 'utf8');
  assert.match(api, /case 'calendar'/);
  assert.match(api, /handleCalendarIcs/);
});

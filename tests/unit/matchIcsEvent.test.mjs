import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMatchDateTime,
  calendarWindowForMatch,
  escapeIcsText,
  toIcsUtc,
  buildIcsEvent,
} from '../../src/lib/matchIcsEvent.js';

test('parseMatchDateTime laeser dansk tid, ikke UTC', () => {
  const dt = parseMatchDateTime('2026-09-25', '19:00');
  assert.equal(dt.zoneName, 'Europe/Copenhagen');
  assert.equal(dt.hour, 19);
});

test('parseMatchDateTime afviser ugyldige inddata', () => {
  assert.equal(parseMatchDateTime('', '19:00'), null);
  assert.equal(parseMatchDateTime('2026-09-25', 'ugyldig'), null);
  assert.equal(parseMatchDateTime('2026-09-25', ''), null);
});

test('parseMatchDateTime klipper tal uden for skalaen', () => {
  const dt = parseMatchDateTime('2026-09-25', '25:99');
  assert.equal(dt.hour, 23);
  assert.equal(dt.minute, 59);
});

test('kampen varer 2 timer naar intet andet er angivet', () => {
  const { start, end } = calendarWindowForMatch({ date: '2026-09-25', time: '19:00' });
  assert.equal(end.diff(start, 'minutes').minutes, 120);
});

test('duration slaar standarden', () => {
  const { start, end } = calendarWindowForMatch({ date: '2026-09-25', time: '19:00', duration: 90 });
  assert.equal(end.diff(start, 'minutes').minutes, 90);
});

test('en kamp over midnat slutter dagen efter', () => {
  // 23:30 -> 00:30 ville ellers give en negativ varighed.
  const { start, end } = calendarWindowForMatch({ date: '2026-09-25', time: '23:30', time_end: '00:30' });
  assert.ok(end > start);
  assert.equal(end.diff(start, 'minutes').minutes, 60);
});

test('calendarWindowForMatch giver null naar starten ikke kan laeses', () => {
  assert.equal(calendarWindowForMatch({ date: '', time: '19:00' }), null);
  assert.equal(calendarWindowForMatch({ date: '2026-09-25', time: 'ugyldig' }), null);
});

test('escapeIcsText beskytter ICS-tegnene', () => {
  assert.equal(escapeIcsText('a;b'), String.raw`a\;b`);
  assert.equal(escapeIcsText('a,b'), String.raw`a\,b`);
  assert.equal(escapeIcsText(String.raw`a\b`), String.raw`a\\b`);
  assert.equal(escapeIcsText('linje1\nlinje2'), String.raw`linje1\nlinje2`);
  assert.equal(escapeIcsText(null), '');
});

test('toIcsUtc skriver UTC i ICS-format', () => {
  const dt = parseMatchDateTime('2026-09-25', '19:00');
  assert.match(toIcsUtc(dt), /^\d{8}T\d{6}Z$/);
  assert.equal(toIcsUtc(dt), '20260925T170000Z'); // CEST = UTC+2
});

test('buildIcsEvent danner en gyldig begivenhed med CRLF', () => {
  const { start, end } = calendarWindowForMatch({ date: '2026-09-25', time: '19:00' });
  const ics = buildIcsEvent({
    uid: 'u;1',
    title: 'Kamp, med komma',
    description: 'linje1\nlinje2',
    location: String.raw`Bane\1`,
    start,
    end,
    url: 'https://eksempel.dk/kamp',
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes(String.raw`UID:u\;1`));
  assert.ok(ics.includes(String.raw`SUMMARY:Kamp\, med komma`));
  assert.ok(ics.includes(String.raw`DESCRIPTION:linje1\nlinje2`));
  assert.ok(ics.includes(String.raw`LOCATION:Bane\\1`));
  assert.match(ics, /^DTSTAMP:\d{8}T\d{6}Z$/m);
});

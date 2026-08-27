import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';

import { buildGoogleCalendarUrl } from '../../src/lib/calendarExport.js';

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

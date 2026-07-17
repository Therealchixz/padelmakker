import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaytomicVenue, playtomicClubDeepUrl } from '../../padelmakker-server/playtomicAllowlist.js';
import { fetchPlaytomicSchedule } from '../../padelmakker-server/playtomicSchedule.js';
import { BANER_VENUES, playtomicSlotsUrl, playtomicClubDeepUrl as clientDeepUrl } from '../../src/lib/banerVenues.js';

test('Playtomic allowlist covers the four Danish clubs in Baner catalog', () => {
  const ids = [
    'playtomic_padelboxen',
    'playtomic_padel_dk',
    'playtomic_the_padel_club_espergaerde',
    'playtomic_padel_herlev',
  ];
  for (const id of ids) {
    assert.ok(getPlaytomicVenue(id), id);
    const v = BANER_VENUES.find((x) => x.id === id);
    assert.equal(v?.kind, 'playtomic', id);
  }
});

test('playtomicClubDeepUrl adds date query', () => {
  const cfg = getPlaytomicVenue('playtomic_padelboxen');
  assert.equal(
    playtomicClubDeepUrl(cfg, '2026-07-18'),
    'https://playtomic.com/clubs/padelboxen?date=2026-07-18'
  );
  assert.equal(clientDeepUrl({ clubSlug: 'padel-dk' }, '2026-07-19').includes('date=2026-07-19'), true);
});

test('playtomicSlotsUrl builds API path', () => {
  assert.equal(
    playtomicSlotsUrl('playtomic_padelboxen', '2026-07-18'),
    '/api/playtomic-slots?venue=playtomic_padelboxen&date=2026-07-18'
  );
});

test('fetchPlaytomicSchedule returns free slots for Padelboxen', async () => {
  const cfg = getPlaytomicVenue('playtomic_padelboxen');
  const dateYmd = '2026-07-18';
  const result = await fetchPlaytomicSchedule(cfg, dateYmd);
  assert.ok(!result.error, result.error);
  assert.equal(result.scheduleDate, dateYmd);
  assert.ok(Array.isArray(result.courts));
  if (result.courts.length > 0) {
    const c = result.courts[0];
    assert.ok(c.name);
    assert.ok(c.slots.every((s) => s.status === 'free' && /^\d{2}:\d{2}$/.test(s.time)));
  }
});

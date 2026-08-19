import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCampaignSpotsLabel,
  growthCampaignEntriesToCsv,
} from '../../src/lib/growthCampaignUtils.js';

const FIRST_200_SLUG = 'first_200';

test('exports first_200 slug constant', () => {
  assert.equal(FIRST_200_SLUG, 'first_200');
});

test('formatCampaignSpotsLabel shows taken/total', () => {
  assert.equal(formatCampaignSpotsLabel({ spots_taken: 12, spots_total: 200 }), '12/200');
  assert.equal(formatCampaignSpotsLabel(null), '0/200');
});

test('growthCampaignEntriesToCsv escapes commas and quotes', () => {
  const csv = growthCampaignEntriesToCsv([
    {
      entry_number: 1,
      full_name: 'Anna "Pro" Jensen',
      name: 'Anna',
      area: 'København',
      user_id: 'uuid-1',
      qualified_at: '2026-08-19T10:00:00Z',
      campaign_consent_at: '2026-08-19T10:00:00Z',
      profile_created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  assert.match(csv, /^entry_number,/);
  assert.match(csv, /"Anna ""Pro"" Jensen"/);
});

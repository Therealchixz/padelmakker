import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('lodtrækning kræver mail og SMS, men ikke spilledag', () => {
  const sql = readFileSync(new URL('../../supabase/sql/growth_campaign_first_200.sql', import.meta.url), 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public._growth_user_qualified');
  const fn = sql.slice(start, sql.indexOf('REVOKE ALL ON FUNCTION public._growth_user_qualified'));
  assert.match(fn, /email_confirmed_at/);
  assert.match(fn, /phone_confirmed_at/);
  assert.doesNotMatch(fn, /availability/);
  assert.doesNotMatch(fn, /available_days/);
  const rules = readFileSync(new URL('../../src/pages/CampaignRulesPage.jsx', import.meta.url), 'utf8');
  assert.match(rules, /bekræftet e-mail og telefon/);
  assert.match(rules, /Spilledag er ikke et krav/);
  assert.doesNotMatch(rules, /mindst én spilledag/);
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

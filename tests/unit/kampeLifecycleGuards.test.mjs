import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('PendingResultConfirmModal uses atomic confirm RPC helper (not loose UPDATE+ELO)', () => {
  const src = readFileSync(join(root, 'src/components/PendingResultConfirmModal.jsx'), 'utf8');
  assert.match(src, /confirmPadelMatchResult/);
  assert.match(src, /rejectPadelMatchResult/);
  assert.doesNotMatch(src, /calculateAndApplyElo/);
  assert.doesNotMatch(
    src,
    /\.from\(['"]match_results['"]\)\s*\n?\s*\.update\(\s*\{\s*confirmed:\s*true/,
  );
});

test('lifecycle hardening SQL blocks mid-event deletes and double results', () => {
  const sql = readFileSync(join(root, 'supabase/sql/harden_kampe_lifecycle_guards.sql'), 'utf8');
  assert.match(sql, /uq_match_results_match_id/);
  assert.match(sql, /t\.status = 'registration'/);
  assert.match(sql, /guard_americano_participant_insert/);
  assert.match(sql, /tournament_full/);
  assert.match(sql, /uq_americano_matches_round_court/);
  assert.match(sql, /lower\(coalesce\(l\.status/);
});

test('LigaTab only notifies full for ready teams', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /maybeNotifyLeagueFull[\s\S]*\.eq\('status', 'ready'\)/);
  assert.match(src, /kun afmelde holdet mens ligaen er åben/);
});

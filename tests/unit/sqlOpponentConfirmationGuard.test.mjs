import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../supabase/sql/match_result_opponent_confirmation_guard.sql');

test('Supabase SQL enforces opponent-team result confirmation before ELO can apply', () => {
  assert.equal(existsSync(sqlPath), true, 'missing opponent confirmation SQL guard');

  const sql = readFileSync(sqlPath, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_confirm_match_result/);
  assert.match(sql, /v_submitter_team <> v_confirmer_team/);
  assert.doesNotMatch(
    sql.match(/CREATE OR REPLACE FUNCTION public\.can_confirm_match_result[\s\S]*?END;\s*\$\$/)?.[0] ?? '',
    /p\.role = 'admin'/,
    'participant helper must not bypass admin PIN checks',
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.has_valid_match_result_confirmation/);
  assert.match(sql, /CREATE POLICY match_results_update_by_participant/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.guard_match_result_confirmation/);
  assert.match(sql, /Result must be confirmed by an opposing team player or admin/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.apply_elo_for_match/);
  assert.match(sql, /NOT public\.has_valid_match_result_confirmation\(v_mr\.match_id, v_mr\.submitted_by, v_mr\.confirmed_by\)/);
});

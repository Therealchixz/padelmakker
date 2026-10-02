/**
 * Ejeren 2. okt. 2026: sletning af en spiller skal være "efter bogen" (GDPR).
 * Der må kun stå tilbage, at en konto blev slettet og hvornår — ikke navn,
 * mail, profil eller bruger-id.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function migration() {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_gdpr_deleted_player_minimal.sql')).pop();
  assert.ok(f, 'mangler migration');
  return readFileSync(join(dir, f), 'utf8');
}

function fnBody(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `mangler ${name}`);
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end);
}

test('arkivet gemmer kun hvornår, af hvem og hvorfor', () => {
  const body = fnBody(migration(), 'archive_profile_before_delete');
  assert.match(body, /INSERT INTO public\.deleted_players_archive \(deleted_by, reason\)/);
  for (const bad of ['email', 'full_name', 'profile_snapshot', 'auth_snapshot', 'old_user_id', 'to_jsonb']) {
    assert.ok(!body.includes(bad), `arkiv-triggeren må ikke gemme ${bad}`);
  }
});

test('eksisterende arkiv-rækker og loglinjer renses', () => {
  const sql = migration();
  assert.match(sql, /ALTER COLUMN old_user_id DROP NOT NULL/);
  assert.match(sql, /ALTER COLUMN profile_snapshot DROP NOT NULL/);
  assert.match(sql, /SET old_user_id = NULL,\s+email = NULL,\s+full_name = NULL,\s+profile_snapshot = NULL,\s+auth_snapshot = NULL/);
  assert.match(sql, /SET details = details - 'deleted_email' - 'deleted_user_id'/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.admin_restore_deleted_profile\(uuid, uuid\);/);
});

test('admin_delete_user skriver hverken mail eller bruger-id i loggen', () => {
  const sql = migration();
  const body = fnBody(sql, 'admin_delete_user');
  assert.ok(!body.includes("'deleted_email'"), 'mail må ikke logges eller returneres');
  assert.ok(!body.includes("'deleted_user_id'"), 'bruger-id må ikke logges eller returneres');
  const log = body.indexOf('PERFORM public._admin_audit_log(');
  const del = body.indexOf('DELETE FROM public.profiles WHERE id = p_user_id;');
  assert.ok(log > 0 && del > 0 && log < del, 'loggen skal stadig skrives før profilen slettes');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_delete_user\(uuid, text\) FROM PUBLIC, anon;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_delete_user\(uuid, text\) TO authenticated;/);
});

/**
 * Ejeren 2. okt. 2026: sletning af en spiller fejlede med
 * "admin_audit_log_target_user_id_fkey". Loggen blev skrevet efter at profilen
 * var slettet; nu skrives den før.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('admin_delete_user logger før profilen slettes', () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_admin_delete_user_audit_fix.sql')).pop();
  assert.ok(f, 'mangler migration');
  const sql = readFileSync(join(dir, f), 'utf8');
  const log = sql.indexOf("PERFORM public._admin_audit_log(");
  const del = sql.indexOf('DELETE FROM public.profiles WHERE id = p_user_id;');
  assert.ok(log > 0 && del > 0 && log < del, 'loggen skal skrives før profilen slettes');
  assert.match(sql, /'deleted_user_id', p_user_id/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_delete_user\(uuid, text\) FROM PUBLIC, anon;/);
});

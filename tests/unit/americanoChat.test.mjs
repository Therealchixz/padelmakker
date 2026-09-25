/**
 * Chat i Americano/Mexicano (ejeren 25. sep. 2026).
 *
 * Afprøvet mod databasen i en tilbagerullet transaktion: opretteren kunne
 * skrive og læse, ingen kunne skrive i en andens navn, en udenforstående
 * kunne hverken skrive eller se beskeder, og anon blev afvist.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const migration = () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_americano_chat.sql')).pop();
  assert.ok(f, 'mangler migration *_americano_chat.sql');
  return readFileSync(join(dir, f), 'utf8');
};

test('kun tilmeldte og opretteren kan læse og skrive', () => {
  const sql = migration();
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.americano_messages FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT SELECT, INSERT, DELETE ON TABLE public\.americano_messages TO authenticated;/);
  const insert = sql.slice(sql.indexOf('CREATE POLICY americano_messages_insert'), sql.indexOf('DROP POLICY IF EXISTS americano_messages_delete'));
  assert.match(insert, /sender_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(insert, /NOT public\.is_banned\(\)/);
  assert.match(insert, /americano_is_participant\(tournament_id, \(SELECT auth\.uid\(\)\)\)/);
  assert.match(insert, /americano_internal_tournament_creator\(tournament_id\) = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /CHECK \(char_length\(btrim\(content\)\) BETWEEN 1 AND 1000\)/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.americano_messages/);
});

test('chatten vises for tilmeldte og opretteren, og notifikationen åbner turneringen', () => {
  const tab = read('src/features/americano/AmericanoTab.tsx');
  assert.match(tab, /\{joined \|\| isCreator \? \(\s*<AmericanoChatPanel/);
  const utils = read('src/lib/americanoChatUtils.js');
  assert.match(utils, /'match_chat',/);
  assert.match(utils, /\{ entityType: 'americano', entityId: tournamentId \}/);
  assert.match(utils, /\.from\('americano_messages'\)/);
});

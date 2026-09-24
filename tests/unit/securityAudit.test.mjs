/**
 * Sikkerhedsgennemgang 24. sep. 2026 (security_audit_sep2026).
 *
 * Afprøvet mod den kørende database i en transaktion, der blev rullet
 * tilbage: profil-insert med role='admin' og elo 3000 blev til player/1000,
 * admin_adjust_elo uden admin-kode blev afvist, modtager kunne ikke rette
 * beskedtekst men stadig markere som læst, og almindelig profil-redigering
 * virker som før.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migration = () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_security_audit_sep2026.sql')).pop();
  assert.ok(f, 'mangler migration *_security_audit_sep2026.sql');
  return readFileSync(join(dir, f), 'utf8');
};

test('profil-insert fra appen nulstiller rolle, rating og udelukkelse', () => {
  const sql = migration();
  assert.match(sql, /CREATE TRIGGER protect_elo_fields_insert\s+BEFORE INSERT ON public\.profiles/);
  for (const line of [
    "NEW.role := 'player'",
    'NEW.elo_rating := 1000',
    'NEW.games_played := 0',
    'NEW.games_won := 0',
    'NEW.americano_elo_rating := 1000',
    'NEW.americano_played := 0',
    'NEW.is_banned := false',
    'NEW.ban_reason := NULL',
    'NEW.phone_verification_exempt := false',
  ]) {
    assert.ok(sql.includes(line), `mangler ${line}`);
  }
});

test('appens egen profil-oprettelse sender ingen beskyttede felter', () => {
  for (const rel of ['src/lib/profileBootstrap.js', 'src/lib/AuthContext.jsx']) {
    const src = readFileSync(join(root, rel), 'utf8');
    for (const m of src.matchAll(/from\('profiles'\)\s*\.upsert\(\s*\{([\s\S]*?)\}/g)) {
      assert.doesNotMatch(m[1], /\b(role|elo_rating|games_played|games_won|is_banned|ban_reason|americano_elo_rating|americano_played)\s*:/, rel);
    }
  }
});

test('admin_adjust_elo kræver admin-kode (is_admin), ikke kun rollen', () => {
  const sql = migration();
  const fn = sql.slice(sql.indexOf('FUNCTION public.admin_adjust_elo'));
  assert.match(fn, /IF NOT public\.is_admin\(\) THEN/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_adjust_elo\(uuid, integer\) FROM PUBLIC, anon;/);
});

test('beskeder: kun læst og reaktion kan ændres fra appen', () => {
  const sql = migration();
  assert.match(sql, /BEFORE UPDATE ON public\.messages/);
  assert.match(sql, /to_jsonb\(NEW\) - 'is_read' - 'reaction'/);
  const chat = readFileSync(join(root, 'src/lib/chatUtils.js'), 'utf8');
  for (const m of chat.matchAll(/from\('messages'\)\s*\.update\(\{([^}]*)\}/g)) {
    assert.match(m[1].trim(), /^is_read:\s*true$/);
  }
});

test('interne hjælpefunktioner kan ikke kaldes uden login', () => {
  const sql = migration();
  for (const fn of [
    '_growth_user_qualified(uuid)',
    'americano_internal_tournament_creator(uuid)',
    'americano_internal_tournament_status(uuid)',
    'americano_is_participant(uuid, uuid)',
    'match_players_free_court_side(uuid, integer, uuid, text)',
  ]) {
    assert.ok(sql.includes(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC, anon;`), fn);
  }
});

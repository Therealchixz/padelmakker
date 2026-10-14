/**
 * Rettelser fra gennemtesten af hjemmesiden (ejeren 14. okt. 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('skrifttypen Inter slås til fra en fil, ikke fra HTML (CSP blokerer onload="…")', () => {
  const html = read('index.html');
  const fontLink = html.split('\n').find((l) => l.includes('data-critical-font'));
  assert.ok(fontLink, 'Inter-linket findes');
  assert.doesNotMatch(fontLink, /onload=/);
  assert.doesNotMatch(html, /\son[a-z]+="/i, 'ingen kode i HTML-attributter');
  assert.ok(html.indexOf('data-critical-font') < html.indexOf('/theme-init.js'), 'scriptet kører efter linket');
  assert.match(read('public/theme-init.js'), /link\[data-critical-font\][\s\S]*rel = 'stylesheet'/);
});

test('footeren har ingen løse "·"-skilletegn mellem linkene', () => {
  assert.doesNotMatch(read('src/components/PublicLegalFooter.jsx'), /<span aria-hidden[^>]*>\s*·\s*<\/span>/);
});

test('forsidens eksempel viser ikke en dato, der bliver forældet', () => {
  assert.doesNotMatch(read('src/lib/landingMockupSteps.js'), /\d{2}\.\d{2}\.20\d{2}/);
});

test('hver side har sin egen titel; ukendte adresser ligner ikke forsiden', () => {
  const src = read('src/components/DocumentHead.jsx');
  for (const path of ['/kampagne/forste-200', '/afmeld', '/profil/fuldfoer']) {
    assert.ok(src.includes(`'${path}': {`), `${path} har en titel`);
  }
  assert.match(src, /\['\/kamp\/'/);
  assert.match(src, /\['\/turnering\/'/);
  assert.match(src, /Siden findes ikke/);
  assert.doesNotMatch(src, /ROUTE_META\[pathname\] \|\| ROUTE_META\['\/'\]/);
});

test('funktioner der kræver login kan ikke kaldes uden login', () => {
  const file = readdirSync(join(root, 'supabase/migrations')).find((f) => f.endsWith('_qa_hardening_anon_rpc.sql'));
  assert.ok(file, 'migrationen findes');
  const sql = read(`supabase/migrations/${file}`);
  const revoked = [...sql.matchAll(/REVOKE EXECUTE ON FUNCTION public\.(\w+)\([^)]*\) FROM PUBLIC, anon;/g)].map((m) => m[1]);
  const granted = [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.(\w+)\([^)]*\) TO authenticated, service_role;/g)].map((m) => m[1]);
  assert.equal(revoked.length, 12);
  assert.deepEqual([...granted].sort(), [...revoked].sort(), 'login-brugere beholder adgangen');
  for (const pub of ['public_platform_stats', 'public_match_preview', 'public_americano_preview', 'get_growth_campaign_public', 'public_upcoming_americano_events']) {
    assert.ok(!revoked.includes(pub), `${pub} er stadig offentlig`);
  }
  assert.match(sql, /consent_log_select_own[\s\S]*FOR SELECT TO authenticated[\s\S]*USING \(user_id = \(select auth\.uid\(\)\)\)/);
});

test('testsiden /design/kampforslag er fjernet (ejeren 14. okt. 2026)', () => {
  assert.doesNotMatch(read('src/padelmakker-platform.jsx'), /design\/kampforslag|ProposalDesignPreview/);
  assert.ok(!readdirSync(join(root, 'src/pages')).includes('ProposalDesignPreviewPage.jsx'));
});

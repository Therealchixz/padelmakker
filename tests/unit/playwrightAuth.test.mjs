import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const unitDir = dirname(fileURLToPath(import.meta.url));

test('E2E auth helper documents captcha bypass via refresh token', async () => {
  const src = await readFile(
    join(unitDir, '../e2e/helpers/supabaseAuth.ts'),
    'utf8',
  );
  assert.match(src, /PLAYWRIGHT_TEST_REFRESH_TOKEN/);
  assert.match(src, /grant_type=refresh_token/);
  assert.match(src, /captcha/i);
});

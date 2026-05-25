import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('E2E auth helper documents captcha bypass via refresh token', async () => {
  const src = await readFile(
    new URL('../../tests/e2e/helpers/supabaseAuth.ts', import.meta.url),
    'utf8',
  );
  assert.match(src, /PLAYWRIGHT_TEST_REFRESH_TOKEN/);
  assert.match(src, /grant_type=refresh_token/);
  assert.match(src, /captcha/i);
});

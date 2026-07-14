#!/usr/bin/env node
/**
 * Verify VITE_TURNSTILE_SITE_KEY is configured for Vercel production.
 *
 *   node scripts/check-turnstile-prod.mjs
 *
 * Uses Vercel CLI when available (reads ~/.vercel auth or VERCEL_TOKEN).
 * Does not print secret values — only whether the env var name exists.
 */
import { spawnSync } from 'node:child_process';

const ENV_NAME = 'VITE_TURNSTILE_SITE_KEY';

function runVercelEnvLs() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['vercel', 'env', 'ls', 'production', '--scope', 'mikes-projects-07a8ff27'];
  const result = spawnSync(npx, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function parseEnvListing(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => line.includes(ENV_NAME));
}

console.log(`Checking Vercel production env for ${ENV_NAME} (project: padelmakker)…\n`);

const { status, stdout, stderr } = runVercelEnvLs();
const combined = `${stdout}\n${stderr}`;

if (status !== 0) {
  console.log('Could not list Vercel env vars automatically.');
  if (stderr.trim()) console.log(stderr.trim());
  console.log(`
Manual check (≈5 min):
1. Vercel → padelmakker → Settings → Environment Variables
2. Confirm ${ENV_NAME} is set for Production (value starts with 0x)
3. Supabase → Authentication → Attack Protection → Captcha: Turnstile (same secret pair)
4. Browser: https://www.padelmakker.dk/login — Turnstile widget should appear above login
`);
  process.exit(0);
}

const found = parseEnvListing(combined);
if (found) {
  console.log(`✓ ${ENV_NAME} is listed in Vercel production environment.`);
  console.log('Next: open https://www.padelmakker.dk/login in a browser and confirm the Turnstile widget renders.');
  process.exit(0);
}

console.log(`✗ ${ENV_NAME} was NOT found in Vercel production env listing.`);
console.log(`
Add it in Vercel → padelmakker → Settings → Environment Variables:
  Name:  ${ENV_NAME}
  Value: Cloudflare Turnstile *site* key (0x…)
  Env:   Production (+ Preview if you want captcha on previews)

Then enable matching Turnstile captcha in Supabase Auth → Attack Protection.
Redeploy production after adding the variable.
`);
process.exit(1);

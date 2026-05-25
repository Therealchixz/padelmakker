#!/usr/bin/env node
/**
 * Hent et nyt refresh_token til GitHub secret PLAYWRIGHT_TEST_REFRESH_TOKEN.
 * Kør lokalt med testbrugerens email/password (virker ikke fra CI pga. captcha).
 *
 *   set VITE_SUPABASE_URL=...
 *   set VITE_SUPABASE_ANON_KEY=...
 *   set PLAYWRIGHT_TEST_EMAIL=...
 *   set PLAYWRIGHT_TEST_PASSWORD=...
 *   npm run e2e:refresh-token
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim()
const password = process.env.PLAYWRIGHT_TEST_PASSWORD

if (!supabaseUrl || !anonKey || !email || !password) {
  console.error(
    'Mangler VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, PLAYWRIGHT_TEST_EMAIL og PLAYWRIGHT_TEST_PASSWORD.',
  )
  process.exit(1)
}

const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
})

const body = await res.json()
if (!res.ok || !body.refresh_token) {
  console.error('Login fejlede:', body.error_description || body.msg || body.error_code || res.status)
  process.exit(1)
}

console.log('')
console.log('Kopiér værdien nedenfor til GitHub → Settings → Secrets → PLAYWRIGHT_TEST_REFRESH_TOKEN')
console.log('')
console.log(body.refresh_token)
console.log('')

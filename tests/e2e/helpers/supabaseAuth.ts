import type { Page } from '@playwright/test'

export type PlaywrightAuthEnv = {
  supabaseUrl: string
  anonKey: string
  email: string
  password: string
  refreshToken?: string
}

type AuthTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  token_type?: string
  user?: unknown
  error_description?: string
  msg?: string
  error_code?: string
}

export function getPlaywrightAuthEnv(): PlaywrightAuthEnv | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim() || ''
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD || ''
  const refreshToken = process.env.PLAYWRIGHT_TEST_REFRESH_TOKEN?.trim()
  if (!supabaseUrl || !anonKey) return null
  if (refreshToken) {
    return { supabaseUrl, anonKey, email, password, refreshToken }
  }
  if (email && password) {
    return { supabaseUrl, anonKey, email, password }
  }
  return null
}

function supabaseStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname
  const projectRef = host.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

async function fetchAuthToken(
  env: PlaywrightAuthEnv,
  grantType: 'password' | 'refresh_token',
  body: Record<string, string>,
): Promise<AuthTokenResponse> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as AuthTokenResponse
}

function authErrorMessage(body: AuthTokenResponse, status: number): string {
  return body.error_description || body.msg || body.error_code || `Auth failed (${status})`
}

function isCaptchaBlocked(message: string): boolean {
  return /captcha/i.test(message)
}

async function injectSession(
  page: Page,
  supabaseUrl: string,
  session: Record<string, unknown>,
): Promise<void> {
  const storageKey = supabaseStorageKey(supabaseUrl)
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* ignore */
      }
    },
    { key: storageKey, value: session },
  )
}

async function seedFromRefreshToken(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: env.refreshToken }),
  })
  const body = (await res.json()) as AuthTokenResponse
  if (!res.ok || !body.access_token) {
    throw new Error(authErrorMessage(body, res.status))
  }
  await injectSession(page, env.supabaseUrl, {
    access_token: body.access_token,
    refresh_token: body.refresh_token || env.refreshToken,
    expires_in: body.expires_in,
    expires_at: body.expires_at,
    token_type: body.token_type || 'bearer',
    user: body.user,
  })
}

async function seedFromPassword(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: env.email, password: env.password }),
  })
  const body = (await res.json()) as AuthTokenResponse
  if (!res.ok || !body.access_token) {
    const msg = authErrorMessage(body, res.status)
    if (isCaptchaBlocked(msg)) {
      throw new Error(
        `${msg} — Supabase tillader ikke password-login fra GitHub CI uden captcha. ` +
          'Tilføj secret PLAYWRIGHT_TEST_REFRESH_TOKEN (se tests/e2e/README.md) ' +
          'eller slå Captcha protection fra under Supabase → Authentication → Attack Protection.',
      )
    }
    throw new Error(msg)
  }
  await injectSession(page, env.supabaseUrl, {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    expires_at: body.expires_at,
    token_type: body.token_type || 'bearer',
    user: body.user,
  })
}

/** Log ind til E2E: refresh-token (CI) eller email/password (lokalt). */
export async function seedPlaywrightAuth(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  if (env.refreshToken) {
    await seedFromRefreshToken(page, env)
    return
  }
  await seedFromPassword(page, env)
}

/** @deprecated Brug seedPlaywrightAuth */
export const seedSupabaseSession = seedPlaywrightAuth

export async function dismissCookieNotice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pm_cookie_notice_v1', '1')
    } catch {
      /* ignore */
    }
  })
}

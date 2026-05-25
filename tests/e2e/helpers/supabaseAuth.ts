import type { Page } from '@playwright/test'

export type PlaywrightAuthEnv = {
  supabaseUrl: string
  anonKey: string
  email: string
  password: string
  refreshToken?: string
  serviceRoleKey?: string
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
  const serviceRoleKey = process.env.PLAYWRIGHT_TEST_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !anonKey) return null
  if (serviceRoleKey && email) {
    return { supabaseUrl, anonKey, email, password, refreshToken, serviceRoleKey }
  }
  if (refreshToken) {
    return { supabaseUrl, anonKey, email, password, refreshToken, serviceRoleKey }
  }
  if (email && password) {
    return { supabaseUrl, anonKey, email, password, serviceRoleKey }
  }
  return null
}

function supabaseStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname
  const projectRef = host.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function authErrorMessage(body: AuthTokenResponse, status: number): string {
  return body.error_description || body.msg || body.error_code || `Auth failed (${status})`
}

function isCaptchaBlocked(message: string): boolean {
  return /captcha/i.test(message)
}

function isStaleRefreshTokenError(message: string): boolean {
  return /invalid refresh token|refresh token not found|refresh_token_not_found/i.test(message)
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
          'Tilføj GitHub secret PLAYWRIGHT_TEST_SERVICE_ROLE_KEY (anbefalet) eller ' +
          'opdater PLAYWRIGHT_TEST_REFRESH_TOKEN (npm run e2e:refresh-token).',
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

/** Admin magic link — virker i CI uden captcha og uden manuel refresh-token rotation. */
async function seedFromServiceRoleMagicLink(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  const serviceRoleKey = env.serviceRoleKey
  if (!serviceRoleKey || !env.email) {
    throw new Error('PLAYWRIGHT_TEST_SERVICE_ROLE_KEY og PLAYWRIGHT_TEST_EMAIL kræves')
  }

  const linkRes = await fetch(`${env.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: env.email }),
  })
  const linkBody = (await linkRes.json()) as {
    properties?: { hashed_token?: string }
    hashed_token?: string
    error_description?: string
    msg?: string
  }
  const tokenHash = linkBody.properties?.hashed_token || linkBody.hashed_token
  if (!linkRes.ok || !tokenHash) {
    throw new Error(
      linkBody.error_description ||
        linkBody.msg ||
        `Service role magic link failed (${linkRes.status})`,
    )
  }

  const verifyRes = await fetch(`${env.supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'email', token_hash: tokenHash }),
  })
  const session = (await verifyRes.json()) as AuthTokenResponse
  if (!verifyRes.ok || !session.access_token) {
    throw new Error(authErrorMessage(session, verifyRes.status))
  }

  await injectSession(page, env.supabaseUrl, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type || 'bearer',
    user: session.user,
  })
}

/** Log ind til E2E: service role (CI) → refresh-token → email/password (lokalt). */
export async function seedPlaywrightAuth(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  if (env.serviceRoleKey && env.email) {
    await seedFromServiceRoleMagicLink(page, env)
    return
  }

  if (env.refreshToken) {
    try {
      await seedFromRefreshToken(page, env)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!isStaleRefreshTokenError(msg)) throw err
      if (env.email && env.password) {
        await seedFromPassword(page, env)
        return
      }
      throw new Error(
        `${msg} — Opdater GitHub secret PLAYWRIGHT_TEST_REFRESH_TOKEN (npm run e2e:refresh-token) ` +
          'eller tilføj PLAYWRIGHT_TEST_SERVICE_ROLE_KEY.',
      )
    }
  }

  if (!env.email || !env.password) {
    throw new Error(
      'Mangler PLAYWRIGHT_TEST_EMAIL/PASSWORD, gyldig PLAYWRIGHT_TEST_REFRESH_TOKEN eller PLAYWRIGHT_TEST_SERVICE_ROLE_KEY.',
    )
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

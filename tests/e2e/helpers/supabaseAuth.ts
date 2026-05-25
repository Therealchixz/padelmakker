import type { Page } from '@playwright/test'

export type PlaywrightAuthEnv = {
  supabaseUrl: string
  anonKey: string
  email: string
  password: string
}

export function getPlaywrightAuthEnv(): PlaywrightAuthEnv | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim()
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD
  if (!supabaseUrl || !anonKey || !email || !password) return null
  return { supabaseUrl, anonKey, email, password }
}

function supabaseStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname
  const projectRef = host.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

/** Log ind via Supabase Auth API og gem session i localStorage (samme nøgle som supabase-js). */
export async function seedSupabaseSession(page: Page, env: PlaywrightAuthEnv): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: env.email, password: env.password }),
  })

  const body = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    expires_at?: number
    token_type?: string
    user?: unknown
    error_description?: string
    msg?: string
  }

  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.msg || `Auth failed (${res.status})`)
  }

  const storageKey = supabaseStorageKey(env.supabaseUrl)
  const session = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    expires_at: body.expires_at,
    token_type: body.token_type || 'bearer',
    user: body.user,
  }

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

export async function dismissCookieNotice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pm_cookie_notice_v1', '1')
    } catch {
      /* ignore */
    }
  })
}

import { useState } from 'react'
import { signInWithOAuthProvider } from '../lib/authOAuth'
import { font, theme, btn } from '../lib/platformTheme'

const oauthBtnStyle = {
  ...btn(false),
  width: '100%',
  justifyContent: 'center',
  gap: '10px',
  fontWeight: 600,
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05 1.88-3.51 1.9-1.46.02-1.93-.86-3.6-.86-1.66 0-2.18.84-3.56.88-1.44.04-2.53-1.47-3.51-2.42-1.92-1.9-3.39-5.38-3.42-8.53-.03-3.15 1.66-4.86 3.26-4.86 1.52 0 2.45.86 3.6.86 1.14 0 1.84-.86 3.59-.86 1.28.02 2.64.74 3.41 2.02-3 1.64-2.51 5.9.95 7.12-.63 1.52-1.62 3.03-2.93 3.09-.66.03-1.44-.38-2.29-.38zM14.03 3.5c.73-.89 1.23-2.12 1.09-3.35-1.05.04-2.32.7-3.08 1.59-.68.78-1.27 2.03-1.11 3.23 1.18.09 2.38-.6 3.1-1.47z" />
    </svg>
  )
}

/**
 * @param {{ onError?: (msg: string) => void, disabled?: boolean, redirectPath?: string }} props
 */
export function OAuthButtons({ onError, disabled = false, redirectPath = '/login' }) {
  const [busy, setBusy] = useState(null)

  const start = async (provider) => {
    if (disabled || busy) return
    setBusy(provider)
    try {
      await signInWithOAuthProvider(provider, redirectPath)
    } catch (e) {
      setBusy(null)
      onError?.(e?.message || 'Login fejlede.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
      <button
        type="button"
        disabled={disabled || !!busy}
        onClick={() => start('google')}
        style={oauthBtnStyle}
      >
        <GoogleIcon />
        {busy === 'google' ? 'Åbner Google…' : 'Fortsæt med Google'}
      </button>
      <button
        type="button"
        disabled={disabled || !!busy}
        onClick={() => start('apple')}
        style={oauthBtnStyle}
      >
        <AppleIcon />
        {busy === 'apple' ? 'Åbner Apple…' : 'Fortsæt med Apple'}
      </button>
    </div>
  )
}

export function AuthDivider() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '4px 0 18px',
        fontFamily: font,
        fontSize: '12px',
        fontWeight: 600,
        color: theme.textLight,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ flex: 1, height: 1, background: theme.border }} />
      eller
      <span style={{ flex: 1, height: 1, background: theme.border }} />
    </div>
  )
}

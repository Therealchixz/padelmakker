import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme'
import { PublicLegalFooter } from '../components/PublicLegalFooter'
import { normalizePhoneToE164 } from '../lib/validationHelpers'
import { TurnstileWidget } from '../components/TurnstileWidget'

const PHONE_SIGNUP_PENDING_KEY = 'pm_phone_signup_pending_v1'

function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length <= 6) return p
  return `${p.slice(0, 5)}***${p.slice(-2)}`
}

function cleanOtp(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6)
}

function readPendingSignup() {
  try {
    const raw = sessionStorage.getItem(PHONE_SIGNUP_PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const phone = normalizePhoneToE164(parsed?.phone)
    const email = String(parsed?.email || '').trim()
    if (!phone) return null
    return { phone, email }
  } catch {
    return null
  }
}

function writePendingSignup(pending) {
  try {
    sessionStorage.setItem(PHONE_SIGNUP_PENDING_KEY, JSON.stringify(pending))
  } catch {
    /* ignore */
  }
}

function clearPendingSignup() {
  try {
    sessionStorage.removeItem(PHONE_SIGNUP_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

function hasPendingSignupMetadata(user) {
  const meta = user?.user_metadata || {}
  return meta.phone_first_signup === true || !!meta.pending_email
}

function shouldUseLegacyPhoneChangeFlow(user) {
  if (!user || user.phone_confirmed_at) return false
  if (hasPendingSignupMetadata(user)) return false
  return true
}

export function PhoneVerificationPage() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
  const turnstileEnabled = turnstileSiteKey.length > 0

  const [mode, setMode] = useState('signup')
  const [phoneInput, setPhoneInput] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [resendAtMs, setResendAtMs] = useState(0)
  const [nowMs, setNowMs] = useState(Date.now())

  const phoneFromState = useMemo(
    () => normalizePhoneToE164(location.state?.phone),
    [location.state?.phone]
  )
  const emailFromState = useMemo(
    () => String(location.state?.email || '').trim(),
    [location.state?.email]
  )

  useEffect(() => {
    if (phoneFromState) {
      const next = { phone: phoneFromState, email: emailFromState }
      writePendingSignup(next)
      setMode('signup')
      setPhoneInput(phoneFromState)
      setPendingPhone(phoneFromState)
      setPendingEmail(emailFromState)
      setOtpSent(true)
      setInfo(`SMS-kode blev sendt til ${maskPhone(phoneFromState)}.`)
      return
    }

    const stored = readPendingSignup()
    if (stored?.phone) {
      setMode('signup')
      setPhoneInput(stored.phone)
      setPendingPhone(stored.phone)
      setPendingEmail(stored.email || '')
      setOtpSent(true)
      return
    }

    const metaPhone = normalizePhoneToE164(user?.user_metadata?.signup_phone || user?.phone || '')
    if (shouldUseLegacyPhoneChangeFlow(user)) {
      setMode('phone_change')
      setPhoneInput((prev) => prev || metaPhone || '')
      setPendingPhone((prev) => prev || metaPhone || '')
      setPendingEmail(String(user?.email || '').trim())
      return
    }

    setMode('signup')
  }, [emailFromState, phoneFromState, user])

  useEffect(() => {
    if (resendAtMs <= Date.now()) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(timer)
  }, [resendAtMs])

  const resendSeconds = Math.max(0, Math.ceil((resendAtMs - nowMs) / 1000))
  const canResend = resendSeconds <= 0
  const normalizedDraftPhone = normalizePhoneToE164(phoneInput)

  const sendCode = async () => {
    const normalizedPhone = normalizePhoneToE164(phoneInput)
    if (!normalizedPhone) {
      setErr('Indtast et gyldigt telefonnummer (fx 20112233 eller +4520112233).')
      return
    }
    if (mode === 'signup' && turnstileEnabled && !captchaToken) {
      setErr('Bekræft venligst, at du ikke er en robot.')
      return
    }

    setSubmitting(true)
    setErr('')
    setInfo('')
    try {
      if (mode === 'phone_change') {
        const { error } = await supabase.auth.updateUser({ phone: normalizedPhone })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resend({
          type: 'sms',
          phone: normalizedPhone,
          options: turnstileEnabled && captchaToken
            ? { captchaToken }
            : undefined,
        })
        if (error) throw error
      }

      if (mode === 'signup') {
        writePendingSignup({ phone: normalizedPhone, email: pendingEmail })
      }
      setPendingPhone(normalizedPhone)
      setOtpSent(true)
      setOtpCode('')
      setResendAtMs(Date.now() + 60_000)
      setNowMs(Date.now())
      setInfo(`SMS-kode sendt til ${maskPhone(normalizedPhone)}.`)
      if (turnstileEnabled) {
        setCaptchaToken('')
        setCaptchaResetNonce((n) => n + 1)
      }
    } catch (e) {
      setErr(e?.message || 'Kunne ikke sende SMS-kode lige nu.')
      if (turnstileEnabled) {
        setCaptchaToken('')
        setCaptchaResetNonce((n) => n + 1)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async () => {
    const token = cleanOtp(otpCode)
    if (!pendingPhone) {
      setErr('Send en SMS-kode først.')
      return
    }
    if (token.length !== 6) {
      setErr('Koden skal være 6 cifre.')
      return
    }

    setSubmitting(true)
    setErr('')
    setInfo('')
    try {
      const verifyType = mode === 'phone_change' ? 'phone_change' : 'sms'
      const { data, error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token,
        type: verifyType,
      })
      if (error) throw error

      const effectiveEmail = String(
        pendingEmail || data?.user?.user_metadata?.pending_email || data?.user?.email || ''
      ).trim()

      if (mode === 'phone_change') {
        await supabase.auth.updateUser({
          data: {
            phone_verification_required: false,
            signup_phone: pendingPhone,
            phone_verified_at: new Date().toISOString(),
          },
        })
        setInfo('Telefonnummer bekræftet. Du bliver sendt videre...')
        navigate('/dashboard', { replace: true })
        return
      }

      if (!effectiveEmail) {
        throw new Error('Mangler email til sidste trin. Gå tilbage og opret igen.')
      }

      const { error: emailErr } = await supabase.auth.updateUser({
        email: effectiveEmail,
        data: {
          pending_email: effectiveEmail,
          signup_phone: pendingPhone,
          phone_verification_required: false,
          phone_verified_at: new Date().toISOString(),
          phone_first_signup: true,
        },
      })
      if (emailErr) throw emailErr

      const uid = data?.user?.id || user?.id
      if (uid) {
        try {
          await supabase.from('profiles').update({ email: effectiveEmail }).eq('id', uid)
        } catch {
          /* ignore */
        }
      }

      clearPendingSignup()
      try { await signOut() } catch { /* ignore */ }

      setInfo('Telefon bekræftet. Tjek nu din e-mail for sidste bekræftelse.')
      navigate('/opret/bekraeft-email', { replace: true, state: { email: effectiveEmail } })
    } catch (e) {
      setErr(e?.message || 'Koden kunne ikke verificeres.')
    } finally {
      setSubmitting(false)
    }
  }

  const noPendingSignup = mode === 'signup' && !pendingPhone && !normalizedDraftPhone

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        padding: 'max(60px, env(safe-area-inset-top)) 20px max(96px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: theme.surface,
          borderRadius: theme.radius,
          padding: '30px 26px',
          boxShadow: theme.shadowLg,
          border: '1px solid ' + theme.border,
        }}
      >
        <h1 style={{ ...heading('24px'), marginBottom: '8px' }}>Bekræft dit telefonnummer</h1>
        <p style={{ color: theme.textMid, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
          {mode === 'phone_change'
            ? 'Indtast telefonnummer og SMS-koden for at fortsætte.'
            : 'Vi har sendt en 6-cifret kode til dit nummer. Indtast den her for at bekræfte kontoen.'}
        </p>

        {noPendingSignup && (
          <div style={{
            background: theme.surfaceAlt,
            border: '1px solid ' + theme.border,
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '14px',
            color: theme.textMid,
            fontSize: '13px',
            lineHeight: 1.5,
          }}>
            Vi kunne ikke finde en aktiv oprettelse. Start venligst fra opret-siden.
          </div>
        )}

        <label htmlFor="verify-phone" style={labelStyle}>Telefonnummer</label>
        <input
          id="verify-phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phoneInput}
          onChange={(e) => {
            setPhoneInput(e.target.value)
            setErr('')
          }}
          placeholder="Fx 20112233 eller +4520112233"
          style={{
            ...inputStyle,
            marginBottom: normalizedDraftPhone ? '14px' : '6px',
            border: '1px solid ' + (normalizedDraftPhone || phoneInput.trim().length === 0 ? theme.border : theme.red),
          }}
        />
        {!normalizedDraftPhone && phoneInput.trim().length > 0 && (
          <p style={{ color: theme.red, fontSize: '12px', marginBottom: '12px', fontWeight: 600 }}>
            Ugyldigt nummer. Brug fx 20112233 eller +4520112233.
          </p>
        )}

        {mode === 'signup' && turnstileEnabled && (
          <div style={{ marginBottom: '14px' }}>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onTokenChange={setCaptchaToken}
              resetNonce={captchaResetNonce}
            />
          </div>
        )}
        <button
          onClick={sendCode}
          disabled={
            submitting ||
            !normalizedDraftPhone ||
            (!canResend && otpSent) ||
            (mode === 'signup' && turnstileEnabled && !captchaToken)
          }
          style={{
            ...btn(true),
            width: '100%',
            justifyContent: 'center',
            marginBottom: '14px',
            opacity:
              submitting ||
              !normalizedDraftPhone ||
              (!canResend && otpSent) ||
              (mode === 'signup' && turnstileEnabled && !captchaToken)
                ? 0.55
                : 1,
            cursor:
              submitting ||
              !normalizedDraftPhone ||
              (!canResend && otpSent) ||
              (mode === 'signup' && turnstileEnabled && !captchaToken)
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {!otpSent ? 'Send SMS-kode' : canResend ? 'Send kode igen' : `Send igen om ${resendSeconds}s`}
        </button>

        {otpSent && (
          <>
            <label htmlFor="verify-otp" style={labelStyle}>SMS-kode</label>
            <input
              id="verify-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(cleanOtp(e.target.value))
                setErr('')
              }}
              placeholder="6 cifre"
              style={{ ...inputStyle, marginBottom: '14px', letterSpacing: '0.22em', textAlign: 'center' }}
            />
            <button
              onClick={verifyCode}
              disabled={submitting || cleanOtp(otpCode).length !== 6}
              style={{
                ...btn(true),
                width: '100%',
                justifyContent: 'center',
                opacity: submitting || cleanOtp(otpCode).length !== 6 ? 0.55 : 1,
                cursor: submitting || cleanOtp(otpCode).length !== 6 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Bekræfter...' : 'Bekræft telefonnummer'}
            </button>
          </>
        )}

        {err && <p style={{ color: theme.red, fontSize: '13px', marginTop: '14px' }}>{err}</p>}
        {info && <p style={{ color: theme.accent, fontSize: '13px', marginTop: '14px', fontWeight: 600 }}>{info}</p>}

        <button
          onClick={async () => {
            clearPendingSignup()
            try { await signOut() } catch { /* ignore */ }
            navigate('/login', { replace: true })
          }}
          style={{
            marginTop: '18px',
            border: 'none',
            background: 'transparent',
            color: theme.textLight,
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Log ud
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', marginTop: '24px' }}>
        <PublicLegalFooter />
      </div>
    </div>
  )
}

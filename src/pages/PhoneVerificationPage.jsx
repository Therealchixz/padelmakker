import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme'
import { PublicLegalFooter } from '../components/PublicLegalFooter'
import { normalizePhoneToE164 } from '../lib/validationHelpers'
import { mapPhoneAuthErrorMessage } from '../lib/authErrorMessages'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { getTurnstileSiteKey, isTurnstileEnabled } from '../lib/turnstileConfig'
import { writePendingSignupEmail } from '../lib/signupEmailPending'
import { readPrefillPhone, clearPrefillPhone } from '../lib/profileCompleteness'
import { tryAutoEnrollGrowthCampaign } from '../lib/growthCampaign'
import { scrollToFieldById } from '../lib/formValidationScroll'
import { shouldUseLegacyPhoneChangeFlow } from '../lib/phoneVerifyMode'

const PHONE_SIGNUP_PENDING_KEY = 'pm_phone_signup_pending_v1'

function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length <= 6) return p
  return `${p.slice(0, 5)}***${p.slice(-2)}`
}

function cleanOtp(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6)
}

/** 6-felts SMS-kode med auto-advance, backspace og indsæt (paste) af hele koden. */
function OtpBoxes({ value, onChange, onComplete, disabled, invalid, focusFirstNonce }) {
  const refs = useRef([])
  useEffect(() => {
    if (focusFirstNonce) refs.current[0]?.focus()
  }, [focusFirstNonce])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const setAt = (i, d) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\D/g, '').slice(0, 6)
    onChange(next)
    return next
  }

  const handleChange = (i, raw) => {
    const d = raw.replace(/\D/g, '')
    if (d.length > 1) {
      // Indsæt/auto-fyld flere cifre fra position i
      const next = (value.slice(0, i) + d).replace(/\D/g, '').slice(0, 6)
      onChange(next)
      const focusIdx = Math.min(next.length, 5)
      refs.current[focusIdx]?.focus()
      if (next.length === 6) onComplete?.(next)
      return
    }
    const next = setAt(i, d)
    if (d && i < 5) refs.current[i + 1]?.focus()
    if (next.length === 6) onComplete?.(next)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setAt(i, '')
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
        setAt(i - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus()
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10, width: '100%' }} role="group" aria-label="6-cifret SMS-kode">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Ciffer ${i + 1}`}
          aria-invalid={invalid || undefined}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          style={{
            // Passer til en 390 px skærm: seks felter må højst fylde kortets bredde.
            flex: '1 1 0',
            minWidth: 0,
            maxWidth: 52,
            height: 56,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: font,
            color: theme.text,
            border: `2px solid ${invalid ? theme.red : d ? theme.accent : theme.border}`,
            borderRadius: 12,
            background: theme.surface,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  )
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

export function PhoneVerificationPage() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const turnstileSiteKey = getTurnstileSiteKey()
  const turnstileEnabled = isTurnstileEnabled()

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
  const [codeInvalid, setCodeInvalid] = useState(false)
  const [focusFirstNonce, setFocusFirstNonce] = useState(0)
  /** Google-brugere (telefonskift) kan rette nummeret her; ved almindelig oprettelse starter man forfra. */
  const [editPhone, setEditPhone] = useState(false)

  const phoneFromState = useMemo(
    () => normalizePhoneToE164(location.state?.phone),
    [location.state?.phone]
  )
  const prefillPhone = useMemo(
    () => normalizePhoneToE164(location.state?.prefillPhone || readPrefillPhone()),
    [location.state?.prefillPhone]
  )
  const emailFromState = useMemo(
    () => String(location.state?.email || '').trim(),
    [location.state?.email]
  )

  useEffect(() => {
    const metaPhone = normalizePhoneToE164(user?.user_metadata?.signup_phone || user?.phone || '')
    // Google-brugere: onboarding har allerede sendt koden som telefonskift.
    // Skal tjekkes før phoneFromState, ellers bliver koden afvist ("User not found").
    if (shouldUseLegacyPhoneChangeFlow(user)) {
      setMode('phone_change')
      const phone = phoneFromState || prefillPhone || metaPhone || ''
      setPhoneInput((prev) => prev || phone)
      setPendingPhone((prev) => prev || phone)
      setPendingEmail(String(user?.email || '').trim())
      if (phoneFromState) {
        setOtpSent(true)
        setResendAtMs(Date.now() + 60_000)
      }
      return
    }

    if (phoneFromState) {
      const next = { phone: phoneFromState, email: emailFromState }
      writePendingSignup(next)
      setMode('signup')
      setPhoneInput(phoneFromState)
      setPendingPhone(phoneFromState)
      setPendingEmail(emailFromState)
      setOtpSent(true)
      // Koden er lige sendt: vent 60 s før "Send kode igen", så en ny kode ikke erstatter den første.
      setResendAtMs(Date.now() + 60_000)
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

    setMode('signup')
  }, [emailFromState, phoneFromState, prefillPhone, user])

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
      scrollToFieldById('verify-phone')
      return
    }
    if (mode === 'signup' && turnstileEnabled && !captchaToken) {
      setErr('Bekræft venligst, at du ikke er en robot.')
      scrollToFieldById('verify-captcha')
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
      setEditPhone(false)
      setCodeInvalid(false)
      setFocusFirstNonce((n) => n + 1)
      setInfo(`Ny kode sendt til ${maskPhone(normalizedPhone)}.`)
      clearPrefillPhone()
      if (turnstileEnabled) {
        setCaptchaToken('')
        setCaptchaResetNonce((n) => n + 1)
      }
    } catch (e) {
      setErr(mapPhoneAuthErrorMessage(e?.message))
      if (turnstileEnabled) {
        setCaptchaToken('')
        setCaptchaResetNonce((n) => n + 1)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Ét tjek ad gangen: auto-tjek ved 6. ciffer og knappen må ikke sende koden to gange.
  const verifyingRef = useRef(false)

  /** @param {string} [codeArg] koden fra OtpBoxes; state er ikke opdateret endnu, når 6. ciffer tastes */
  const verifyCode = async (codeArg) => {
    if (verifyingRef.current) return
    const token = cleanOtp(typeof codeArg === 'string' ? codeArg : otpCode)
    if (!pendingPhone) {
      setErr('Send en SMS-kode først.')
      scrollToFieldById('verify-phone')
      return
    }
    if (token.length !== 6) {
      setErr('Koden skal være 6 cifre.')
      scrollToFieldById('verify-otp')
      return
    }

    verifyingRef.current = true
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
        void tryAutoEnrollGrowthCampaign()
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
      try {
        await signOut()
      } catch {
        /* dashboard er gated på email_confirmed_at — fortsæt til email-trin */
      }

      writePendingSignupEmail({ email: effectiveEmail, phone: pendingPhone || undefined })
      setInfo(
        'Telefon bekræftet (trin 2/3). Du bliver logget ud nu — det er med vilje. Næste trin: åbn linket i emailen (trin 3/3), og log derefter ind.',
      )
      navigate('/opret/bekraeft-email', {
        replace: true,
        state: { email: effectiveEmail, phone: pendingPhone || '' },
      })
    } catch (e) {
      setErr(mapPhoneAuthErrorMessage(e?.message))
      // Forkert kode: ryd felterne og sæt markøren i første felt, så man kan prøve igen med det samme.
      setCodeInvalid(true)
      setOtpCode('')
      setFocusFirstNonce((n) => n + 1)
    } finally {
      verifyingRef.current = false
      setSubmitting(false)
    }
  }

  const noPendingSignup = mode === 'signup' && !pendingPhone && !normalizedDraftPhone
  const showPhoneForm = !otpSent || editPhone
  const startOver = async () => {
    clearPendingSignup()
    try { await signOut() } catch { /* ignore */ }
    navigate('/opret', { replace: true })
  }
  const linkBtn = {
    border: 'none',
    background: 'transparent',
    color: theme.accent,
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: font,
    cursor: 'pointer',
    minHeight: '44px',
    padding: '0 4px',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  }

  return (
    <div
      className="pm-root pm-brand"
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
      <div className="pm-auth-panel pm-auth-panel--centered">
        <p style={{ fontSize: '12px', fontWeight: 700, color: theme.accent, marginBottom: '10px', letterSpacing: '0.04em' }}>
          {mode === 'phone_change' ? 'Sidste trin · SMS-kode' : 'Næsten færdig · SMS-kode'}
        </p>
        <h1 style={{ ...heading('24px'), marginBottom: '8px' }}>
          {otpSent && !editPhone ? 'Indtast koden fra SMS’en' : 'Bekræft dit telefonnummer'}
        </h1>
        <p style={{ color: theme.textMid, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
          {otpSent && !editPhone ? (
            <>Vi har sendt en 6-cifret kode til <strong style={{ color: theme.text }}>{maskPhone(pendingPhone)}</strong>.</>
          ) : mode === 'phone_change' ? (
            'Skriv dit telefonnummer, så sender vi en 6-cifret kode på SMS.'
          ) : (
            'Vi sender en 6-cifret kode på SMS. Den bekræfter, at du er en rigtig spiller.'
          )}
        </p>

        {noPendingSignup && (
          <div className="pm-auth-info-card">
            Vi kunne ikke finde en aktiv oprettelse. Start venligst fra opret-siden.
          </div>
        )}

        {otpSent && !editPhone && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void verifyCode()
            }}
          >
            <div id="verify-otp" />
            <OtpBoxes
              value={otpCode}
              disabled={submitting}
              invalid={codeInvalid}
              focusFirstNonce={focusFirstNonce}
              onChange={(v) => { setOtpCode(v); setErr(''); setCodeInvalid(false) }}
              onComplete={(code) => { void verifyCode(code) }}
            />
            <div role="alert" aria-live="assertive" style={{ minHeight: err ? undefined : 0 }}>
              {err && <p style={{ color: theme.red, fontSize: '13.5px', fontWeight: 600, lineHeight: 1.45, margin: '0 0 12px' }}>{err}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...btn(true),
                width: '100%',
                justifyContent: 'center',
                opacity: submitting ? 0.55 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Bekræfter…' : 'Bekræft telefonnummer'}
            </button>
            {info && <p role="status" style={{ color: theme.accent, fontSize: '13px', marginTop: '12px', fontWeight: 600, lineHeight: 1.45 }}>{info}</p>}
          </form>
        )}

        {otpSent && !editPhone && (
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: `1px solid ${theme.border}` }}>
            <p style={{ fontSize: '13px', color: theme.textMid, margin: '0 0 4px', lineHeight: 1.5 }}>
              Ingen SMS? Det kan tage op til et minut.
            </p>
            {canResend && mode === 'signup' && turnstileEnabled && (
              <div id="verify-captcha" style={{ margin: '8px 0' }}>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={setCaptchaToken}
                  resetNonce={captchaResetNonce}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0 12px' }}>
              <button
                type="button"
                onClick={() => { void sendCode() }}
                disabled={submitting || !canResend}
                style={{ ...linkBtn, color: canResend ? theme.accent : theme.textLight, cursor: canResend ? 'pointer' : 'default', textDecoration: canResend ? 'underline' : 'none' }}
              >
                {canResend ? 'Send kode igen' : `Send ny kode om ${resendSeconds} s`}
              </button>
              {mode === 'phone_change' ? (
                <button type="button" onClick={() => { setEditPhone(true); setErr('') }} style={linkBtn}>
                  Forkert nummer?
                </button>
              ) : (
                <button type="button" onClick={() => { void startOver() }} style={linkBtn}>
                  Forkert nummer? Start forfra
                </button>
              )}
            </div>
          </div>
        )}

        {showPhoneForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendCode()
            }}
          >
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
              aria-invalid={(!normalizedDraftPhone && phoneInput.trim().length > 0) || undefined}
              aria-describedby="verify-phone-error"
              style={{
                ...inputStyle,
                marginBottom: normalizedDraftPhone ? '14px' : '6px',
                border: '1px solid ' + (normalizedDraftPhone || phoneInput.trim().length === 0 ? theme.border : theme.red),
              }}
            />
            {!normalizedDraftPhone && phoneInput.trim().length > 0 && (
              <p id="verify-phone-error" style={{ color: theme.red, fontSize: '12.5px', marginBottom: '12px', fontWeight: 600 }}>
                Ugyldigt nummer. Brug fx 20112233 eller +4520112233.
              </p>
            )}

            {mode === 'signup' && turnstileEnabled && (
              <div id="verify-captcha" style={{ marginBottom: '14px' }}>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={setCaptchaToken}
                  resetNonce={captchaResetNonce}
                />
              </div>
            )}
            <div role="alert" aria-live="assertive">
              {err && <p style={{ color: theme.red, fontSize: '13.5px', fontWeight: 600, lineHeight: 1.45, margin: '0 0 12px' }}>{err}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting || (!canResend && otpSent)}
              style={{
                ...btn(true),
                width: '100%',
                justifyContent: 'center',
                opacity: submitting || (!canResend && otpSent) ? 0.55 : 1,
                cursor: submitting || (!canResend && otpSent) ? 'not-allowed' : 'pointer',
              }}
            >
              {!otpSent || canResend ? 'Send SMS-kode' : `Send igen om ${resendSeconds} s`}
            </button>
            {editPhone && (
              <button type="button" onClick={() => setEditPhone(false)} style={{ ...linkBtn, width: '100%', marginTop: '6px' }}>
                Tilbage til koden
              </button>
            )}
          </form>
        )}

        {mode === 'signup' && otpSent && (
          <div className="pm-auth-post-verify-note">
            <strong style={{ color: theme.text }}>Efter bekræftelse:</strong> Du logges kort ud, så du kan bekræfte email på
            næste side. Det er med vilje — så login først virker, når både telefon og email er bekræftet.
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '420px', marginTop: '24px' }}>
        <PublicLegalFooter />
      </div>
    </div>
  )
}

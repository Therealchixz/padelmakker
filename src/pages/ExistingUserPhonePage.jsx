import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme'
import { PublicLegalFooter } from '../components/PublicLegalFooter'
import { normalizePhoneToE164 } from '../lib/validationHelpers'
import {
  mapPhoneAuthError,
  shouldRequirePhoneVerification,
} from '../lib/phoneVerification'
import { Shield } from 'lucide-react'

function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length <= 6) return p
  return `${p.slice(0, 5)}***${p.slice(-2)}`
}

function cleanOtp(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6)
}

function displayAccountName(user, profile) {
  const fromProfile = String(profile?.full_name || profile?.name || '').trim()
  if (fromProfile) return fromProfile
  const meta = user?.user_metadata || {}
  return String(meta.full_name || meta.name || '').trim()
}

export function ExistingUserPhonePage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const accountName = displayAccountName(user, profile)
  const accountEmail = String(user?.email || '').trim()

  const [phoneInput, setPhoneInput] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [resendAtMs, setResendAtMs] = useState(0)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    if (!user || !profile) return
    if (!shouldRequirePhoneVerification(user, profile)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, profile, navigate])

  useEffect(() => {
    const metaPhone = normalizePhoneToE164(user?.user_metadata?.signup_phone || user?.phone || '')
    if (metaPhone) {
      setPhoneInput((prev) => prev || metaPhone)
      setPendingPhone((prev) => prev || metaPhone)
    }
  }, [user])

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

    setSubmitting(true)
    setErr('')
    setInfo('')
    try {
      const { error } = await supabase.auth.updateUser({ phone: normalizedPhone })
      if (error) throw error
      setPendingPhone(normalizedPhone)
      setOtpSent(true)
      setOtpCode('')
      setResendAtMs(Date.now() + 60_000)
      setNowMs(Date.now())
      setInfo(`SMS-kode sendt til ${maskPhone(normalizedPhone)}.`)
    } catch (e) {
      setErr(mapPhoneAuthError(e?.message) || 'Kunne ikke sende SMS-kode lige nu.')
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
      const { error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token,
        type: 'phone_change',
      })
      if (error) throw error

      await supabase.auth.updateUser({
        data: {
          phone_verification_required: false,
          signup_phone: pendingPhone,
          phone_verified_at: new Date().toISOString(),
        },
      })

      refreshProfile()
      setInfo('Telefonnummer bekræftet. Du bliver sendt videre...')
      navigate('/', { replace: true })
    } catch (e) {
      setErr(mapPhoneAuthError(e?.message) || 'Koden kunne ikke verificeres.')
    } finally {
      setSubmitting(false)
    }
  }

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
        <h1 style={{ ...heading('24px'), marginBottom: '8px' }}>Tilføj dit telefonnummer</h1>
        <p style={{ color: theme.textMid, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
          Vi har opdateret sikkerheden på PadelMakker. Alle konti skal have et bekræftet telefonnummer,
          så vi kan mindske falske profiler og sikre, at hvert nummer kun knyttes til én bruger.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            background: theme.accentBg,
            border: '1px solid ' + theme.accent + '26',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '18px',
          }}
        >
          <Shield size={18} style={{ color: theme.accent, flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5 }}>
            {accountName ? (
              <p style={{ margin: '0 0 6px' }}>
                Logget ind som <strong style={{ color: theme.text }}>{accountName}</strong>
                {accountEmail ? (
                  <>
                    {' '}
                    (<span style={{ wordBreak: 'break-all' }}>{accountEmail}</span>)
                  </>
                ) : null}
              </p>
            ) : accountEmail ? (
              <p style={{ margin: '0 0 6px' }}>
                Logget ind med <strong style={{ color: theme.text }}>{accountEmail}</strong>
              </p>
            ) : null}
            <p style={{ margin: 0 }}>
              Dit navn og din alder ændres ikke her — du tilføjer kun et telefonnummer til din eksisterende konto.
            </p>
          </div>
        </div>

        <label htmlFor="existing-verify-phone" style={labelStyle}>
          Telefonnummer
        </label>
        <input
          id="existing-verify-phone"
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
            border:
              '1px solid ' +
              (normalizedDraftPhone || phoneInput.trim().length === 0 ? theme.border : theme.red),
          }}
        />
        {!normalizedDraftPhone && phoneInput.trim().length > 0 && (
          <p style={{ color: theme.red, fontSize: '12px', marginBottom: '12px', fontWeight: 600 }}>
            Ugyldigt format. Brug 8 cifre (fx 21162004) eller +4521162004.
          </p>
        )}

        <button
          type="button"
          onClick={sendCode}
          disabled={submitting || !normalizedDraftPhone || (!canResend && otpSent)}
          style={{
            ...btn(true),
            width: '100%',
            justifyContent: 'center',
            marginBottom: '14px',
            opacity: submitting || !normalizedDraftPhone || (!canResend && otpSent) ? 0.55 : 1,
            cursor:
              submitting || !normalizedDraftPhone || (!canResend && otpSent) ? 'not-allowed' : 'pointer',
          }}
        >
          {!otpSent ? 'Send SMS-kode' : canResend ? 'Send kode igen' : `Send igen om ${resendSeconds}s`}
        </button>

        {otpSent && (
          <>
            <label htmlFor="existing-verify-otp" style={labelStyle}>
              SMS-kode
            </label>
            <input
              id="existing-verify-otp"
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
              type="button"
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
              {submitting ? 'Bekræfter...' : 'Bekræft og fortsæt'}
            </button>
          </>
        )}

        {err && <p style={{ color: theme.red, fontSize: '13px', marginTop: '14px' }}>{err}</p>}
        {info && (
          <p style={{ color: theme.accent, fontSize: '13px', marginTop: '14px', fontWeight: 600 }}>{info}</p>
        )}

        <button
          type="button"
          onClick={async () => {
            try {
              await signOut()
            } catch {
              /* ignore */
            }
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
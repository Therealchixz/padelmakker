import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme'
import { PublicLegalFooter } from '../components/PublicLegalFooter'
import { normalizePhoneToE164 } from '../lib/validationHelpers'

function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length <= 6) return p
  return `${p.slice(0, 5)}•••${p.slice(-2)}`
}

function cleanOtp(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6)
}

export function PhoneVerificationPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [phoneInput, setPhoneInput] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [resendAtMs, setResendAtMs] = useState(0)
  const [nowMs, setNowMs] = useState(Date.now())

  const metadataPhone = String(user?.user_metadata?.signup_phone || '').trim()
  const userPhone = String(user?.phone || '').trim()
  const initialPhone = useMemo(
    () => normalizePhoneToE164(userPhone || metadataPhone),
    [metadataPhone, userPhone]
  )

  useEffect(() => {
    if (initialPhone && !phoneInput) setPhoneInput(initialPhone)
  }, [initialPhone, phoneInput])

  useEffect(() => {
    if (user?.phone_confirmed_at) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, user?.phone_confirmed_at])

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
      setErr(e?.message || 'Kunne ikke sende SMS-kode lige nu.')
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async () => {
    const token = cleanOtp(otpCode)
    if (!pendingPhone) {
      setErr('Send en SMS-kode foerst.')
      return
    }
    if (token.length !== 6) {
      setErr('Koden skal vaere 6 cifre.')
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
      setInfo('Telefonnummer bekraeftet. Du bliver sendt videre...')
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e?.message || 'Koden kunne ikke verificeres.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

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
        <h1 style={{ ...heading('24px'), marginBottom: '8px' }}>Bekraeft dit telefonnummer</h1>
        <p style={{ color: theme.textMid, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
          Dette er kun et ekstra sikkerhedstrin ved oprettelse. Normal login er stadig email + adgangskode.
        </p>

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

        <button
          onClick={sendCode}
          disabled={submitting || !normalizedDraftPhone || (!canResend && otpSent)}
          style={{
            ...btn(true),
            width: '100%',
            justifyContent: 'center',
            marginBottom: '14px',
            opacity: submitting || !normalizedDraftPhone || (!canResend && otpSent) ? 0.55 : 1,
            cursor: submitting || !normalizedDraftPhone || (!canResend && otpSent) ? 'not-allowed' : 'pointer',
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
              {submitting ? 'Bekraefter...' : 'Bekraeft telefonnummer'}
            </button>
          </>
        )}

        {err && <p style={{ color: theme.red, fontSize: '13px', marginTop: '14px' }}>{err}</p>}
        {info && <p style={{ color: theme.accent, fontSize: '13px', marginTop: '14px', fontWeight: 600 }}>{info}</p>}

        <button
          onClick={async () => {
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

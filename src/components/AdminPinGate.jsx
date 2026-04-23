import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { theme, btn, font } from '../lib/platformTheme';

const DEFAULT_REMEMBER_MINUTES = 12 * 60;

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function pinIsValid(pin) {
  return /^\d{6}$/.test(String(pin || ''));
}

function formatDaTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function AdminPinGate({ userId, showToast, onUnlocked }) {
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [errorText, setErrorText] = useState('');
  const [lockUntil, setLockUntil] = useState(null);

  const mode = useMemo(() => (hasPin ? 'verify' : 'setup'), [hasPin]);

  const toFriendlyError = (err, fallbackText) => {
    const msg = String(err?.message || '');
    const code = String(err?.code || '');
    const missingRpc = code === 'PGRST202'
      || msg.includes('schema cache')
      || msg.includes('Could not find the function public.admin_pin_status');
    if (missingRpc) {
      return 'Admin PIN er ikke aktiveret i databasen endnu. Kør SQL-scriptet "supabase/sql/admin_pin_guard.sql" i Supabase SQL Editor, og prøv igen.';
    }
    return msg || fallbackText;
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadStatus = async () => {
      setLoading(true);
      setErrorText('');
      setLockUntil(null);
      try {
        const { data, error } = await supabase.rpc('admin_pin_status');
        if (error) throw error;

        const status = data || {};
        if (cancelled) return;
        // Sikkerhedskrav: Der skal altid tastes kode ved adgang til admin-fanen.
        setHasPin(status.has_pin === true);
      } catch (err) {
        if (cancelled) return;
        const message = toFriendlyError(err, 'Kunne ikke tjekke admin-kode.');
        setErrorText(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStatus();
    return () => { cancelled = true; };
  }, [userId, onUnlocked]);

  const handleSetup = async () => {
    setErrorText('');
    setLockUntil(null);

    const setupPin = digitsOnly(pin);
    const confirmPin = digitsOnly(pinConfirm);
    if (!pinIsValid(setupPin)) {
      setErrorText('Koden skal være præcis 6 tal.');
      return;
    }
    if (setupPin !== confirmPin) {
      setErrorText('Koderne matcher ikke.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_setup_pin', {
        p_pin: setupPin,
        p_remember_minutes: DEFAULT_REMEMBER_MINUTES,
      });
      if (error) throw error;
      onUnlocked?.(data?.verified_until || null);
      showToast?.('Admin-kode oprettet.');
    } catch (err) {
      const message = toFriendlyError(err, 'Kunne ikke oprette admin-kode.');
      setErrorText(message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setErrorText('');

    const verifyPin = digitsOnly(pin);
    if (!pinIsValid(verifyPin)) {
      setErrorText('Indtast din 6-cifrede kode.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_verify_pin', {
        p_pin: verifyPin,
        p_remember_minutes: DEFAULT_REMEMBER_MINUTES,
      });
      if (error) throw error;

      if (!data?.ok) {
        if (data?.reason === 'locked') {
          setLockUntil(data?.locked_until || null);
          setErrorText('For mange forkerte forsøg. Prøv igen senere.');
          return;
        }
        setErrorText('Forkert kode. Prøv igen.');
        return;
      }

      onUnlocked?.(data?.verified_until || null);
      showToast?.('Admin-adgang godkendt.');
    } catch (err) {
      const message = toFriendlyError(err, 'Kunne ikke verificere admin-kode.');
      setErrorText(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admin sikkerhedskode"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10030,
        background: 'rgba(2, 6, 23, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          background: theme.surface,
          border: '1px solid ' + theme.border,
          borderRadius: '14px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.24)',
          overflow: 'hidden',
          fontFamily: font,
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid ' + theme.border }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color={theme.accent} />
            <span style={{ fontSize: '16px', fontWeight: 800, color: theme.text }}>Admin sikkerhed</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: theme.textMid, lineHeight: 1.5 }}>
            {mode === 'setup'
              ? 'Første gang: Opret en 6-cifret kode for at beskytte admin-adgang.'
              : 'Indtast din 6-cifrede admin-kode for at fortsætte.'}
          </div>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ fontSize: '13px', color: theme.textMid, padding: '8px 0' }}>
              Tjekker admin-status...
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: theme.textMid }}>
                  {mode === 'setup' ? 'Ny kode (6 tal)' : 'Kode (6 tal)'}
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(digitsOnly(event.target.value))}
                  placeholder="123456"
                  disabled={busy}
                  style={{
                    width: '100%',
                    border: '1px solid ' + theme.border,
                    borderRadius: '10px',
                    padding: '11px 12px',
                    fontSize: '16px',
                    letterSpacing: '0.2em',
                    fontFamily: font,
                    color: theme.text,
                    background: theme.surface,
                    outline: 'none',
                  }}
                />
              </label>

              {mode === 'setup' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: theme.textMid }}>
                    Bekræft kode
                  </span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={(event) => setPinConfirm(digitsOnly(event.target.value))}
                    placeholder="123456"
                    disabled={busy}
                    style={{
                      width: '100%',
                      border: '1px solid ' + theme.border,
                      borderRadius: '10px',
                      padding: '11px 12px',
                      fontSize: '16px',
                      letterSpacing: '0.2em',
                      fontFamily: font,
                      color: theme.text,
                      background: theme.surface,
                      outline: 'none',
                    }}
                  />
                </label>
              )}

              {errorText && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#b91c1c',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    lineHeight: 1.45,
                  }}
                >
                  {errorText}
                  {lockUntil && (
                    <div style={{ marginTop: '4px', color: '#991b1b' }}>
                      Låst indtil: {formatDaTime(lockUntil)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid ' + theme.border,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (mode === 'setup') void handleSetup();
              else void handleVerify();
            }}
            disabled={loading || busy}
            style={{
              ...btn(true),
              minHeight: '36px',
              fontSize: '12px',
              padding: '8px 12px',
              opacity: loading || busy ? 0.65 : 1,
              cursor: loading || busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy
              ? 'Arbejder...'
              : mode === 'setup'
                ? 'Opret kode'
                : 'Fortsæt til Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

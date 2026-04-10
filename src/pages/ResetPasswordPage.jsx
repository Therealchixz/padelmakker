import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { KeyRound } from 'lucide-react';

export function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 8) { setErr("Adgangskode skal være mindst 8 tegn"); return; }
    if (password !== confirm) { setErr("Adgangskoderne matcher ikke"); return; }
    setSubmitting(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e.message || "Kunne ikke opdatere adgangskode. Prøv igen.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text, paddingBottom: "max(96px, env(safe-area-inset-bottom))" }}>
      <div className="pm-auth-narrow">
        <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Ny adgangskode</h1>
        <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Vælg din nye adgangskode.</p>
        <label htmlFor="reset-password" style={labelStyle}>Ny adgangskode</label>
        <input id="reset-password" autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setErr(""); }} placeholder="Mindst 8 tegn" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
        <label htmlFor="reset-confirm" style={labelStyle}>Gentag adgangskode</label>
        <input id="reset-confirm" autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setErr(""); }} placeholder="Gentag adgangskode" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
        {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
        <button onClick={handleReset} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
          {submitting ? "Opdaterer..." : <><KeyRound size={14} /> Gem ny adgangskode</>}
        </button>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

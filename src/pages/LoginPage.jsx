import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [err, setErr]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr("Indtast email og adgangskode"); return; }
    setSubmitting(true); setErr("");
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setErr(e.message || "Login fejlede. Tjek email og adgangskode.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes("@")) { setErr("Indtast din email først"); return; }
    setSubmitting(true); setErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (e) {
      setErr(e.message || "Kunne ikke sende nulstillingsmail.");
    } finally { setSubmitting(false); }
  };

  if (forgotMode) {
    return (
      <div className="pm-auth-narrow">
        <button onClick={() => { setForgotMode(false); setForgotSent(false); setErr(""); }} style={{ ...btn(false), marginBottom: "40px", padding: "8px 14px", fontSize: "13px" }}>← Tilbage til login</button>
        <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Glemt adgangskode</h1>
        {forgotSent ? (
          <div style={{ background: theme.accentBg, padding: "20px", borderRadius: theme.radius, marginTop: "20px" }}>
            <p style={{ fontSize: "14px", color: theme.accent, fontWeight: 600, marginBottom: "8px" }}>✉️ Mail sendt!</p>
            <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5 }}>Tjek din indbakke på <strong>{email}</strong> og følg linket for at nulstille din adgangskode.</p>
          </div>
        ) : (
          <>
            <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Indtast din email, så sender vi et link til at nulstille din adgangskode.</p>
            <label style={labelStyle}>Email</label>
            <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="din@email.dk" style={{ ...inputStyle, marginBottom: "14px" }} />
            {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
            <button onClick={handleForgotPassword} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
              {submitting ? "Sender..." : "Send nulstillingslink"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pm-auth-narrow">
      <button onClick={() => navigate("/")} style={{ ...btn(false), marginBottom: "40px", padding: "8px 14px", fontSize: "13px" }}>← Tilbage</button>
      <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Velkommen tilbage</h1>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Log ind med din email og adgangskode.</p>
      <label style={labelStyle}>Email</label>
      <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="din@email.dk" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Adgangskode</label>
      <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }} placeholder="••••••••" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
      <button onClick={handleLogin} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
        {submitting ? "Logger ind..." : "Log ind"}
      </button>
      <button onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: theme.accent, fontSize: "13px", marginTop: "16px", cursor: "pointer", fontFamily: font, fontWeight: 500, width: "100%", textAlign: "center" }}>
        Glemt adgangskode?
      </button>
    </div>
  );
}

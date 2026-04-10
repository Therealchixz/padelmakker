import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { REGIONS, AVAILABILITY, PLAY_STYLES, LEVELS } from '../lib/platformConstants';
import { sanitizeText } from '../lib/platformUtils';
import { validateFirstLastName } from '../lib/profileUtils';
import { isValidSignupEmail } from '../lib/validationHelpers';
import { savePendingAvatar } from '../lib/avatarUpload';
import { AvatarPicker } from '../components/AvatarPicker';
import { ArrowRight } from 'lucide-react';

export function OnboardingPage({ onComplete }) {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", password: "", password_confirm: "", level: "", style: "", area: "", availability: [], bio: "", avatar: "🎾", birth_year: "" });
  const [avatarFile, setAvatarFile]         = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const passwordMismatch =
    form.password_confirm.length > 0 &&
    form.password !== form.password_confirm;
  const passwordTooShort =
    form.password_confirm.length > 0 && form.password.length > 0 && form.password.length < 8;

  const emailTouchedInvalid =
    form.email.trim().length > 0 && !isValidSignupEmail(form.email);

  const canNext = () => {
    if (step === 0)
      return (
        validateFirstLastName(form.first_name, form.last_name).valid &&
        isValidSignupEmail(form.email) &&
        form.password.length >= 8 &&
        form.password === form.password_confirm &&
        form.birth_year.length === 4
      );
    if (step === 1) return form.level && form.style;
    if (step === 2) return form.area && form.availability.length > 0;
    return true;
  };

  const finish = async () => {
    setSubmitting(true); setErr("");
    try {
      const nameCheck = validateFirstLastName(form.first_name, form.last_name);
      if (!nameCheck.valid) {
        setErr(nameCheck.message);
        return;
      }
      if (form.password.length < 8) {
        setErr("Adgangskoden skal være mindst 8 tegn.");
        return;
      }
      if (form.password !== form.password_confirm) {
        setErr("Adgangskoderne er ikke ens — tjek begge felter.");
        return;
      }
      if (!isValidSignupEmail(form.email)) {
        setErr("Indtast en gyldig e-mail (fx navn@domæne.dk).");
        return;
      }
      const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const levelNum = parseFloat(form.level.match(/\d+/)?.[0] || "5");
      const signData = await signUp(form.email.trim(), form.password, {
        full_name: sanitizeText(displayName),
        level: levelNum,
        play_style: form.style,
        area: form.area,
        availability: form.availability,
        bio: sanitizeText(form.bio),
        avatar: form.avatar,
        birth_year: parseInt(form.birth_year, 10) || null,
        /** Én-gangs merge til profiles hvis DB-trigger har oprettet en minimal række først */
        onboarding_completed: true,
      });
      /* Gem profilbillede til sessionStorage — uploades automatisk ved næste login */
      if (avatarFile) {
        await savePendingAvatar(avatarFile);
      }
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      if (onComplete) onComplete();
      /* Altid til login: undgå at blive på /opret eller auto-dashboard når der opstår en session */
      try { await signOut(); } catch { /* fortsæt til login alligevel */ }
      navigate("/login", { replace: true });
    } catch (e) {
      setErr(e.message || "Kunne ikke oprette profil.");
    } finally {
      setSubmitting(false);
    }
  };

  const selBtn = (active) => ({ ...btn(active), textAlign: "left", padding: "11px 16px" });

  const steps = [
    <div key={0}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Velkommen! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Lad os oprette din profil.</p>
      <label htmlFor="onb-first-name" style={labelStyle}>Fornavn</label>
      <input id="onb-first-name" autoComplete="given-name" value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" style={{ ...inputStyle, marginBottom: "10px" }} />
      <label htmlFor="onb-last-name" style={labelStyle}>Efternavn</label>
      <input id="onb-last-name" autoComplete="family-name" value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label htmlFor="onb-email" style={labelStyle}>Email</label>
      <input
        id="onb-email"
        value={form.email}
        onChange={e => set("email", e.target.value)}
        placeholder="din@email.dk"
        type="email"
        autoComplete="email"
        style={{
          ...inputStyle,
          marginBottom: emailTouchedInvalid ? "6px" : "14px",
          border: "1px solid " + (emailTouchedInvalid ? theme.red : theme.border),
        }}
      />
      {emailTouchedInvalid && (
        <p style={{ color: theme.red, fontSize: "12px", marginBottom: "10px", fontWeight: 600 }}>
          Brug en gyldig e-mail med @ og domæne (fx navn@mail.dk).
        </p>
      )}
      <label htmlFor="onb-password" style={labelStyle}>Adgangskode</label>
      <input id="onb-password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mindst 8 tegn" type="password" autoComplete="new-password" style={{ ...inputStyle, marginBottom: "10px" }} />
      <label htmlFor="onb-password-confirm" style={labelStyle}>Bekræft adgangskode</label>
      <input
        id="onb-password-confirm"
        value={form.password_confirm}
        onChange={e => set("password_confirm", e.target.value)}
        placeholder="Gentag adgangskode"
        type="password"
        autoComplete="new-password"
        style={{
          ...inputStyle,
          marginBottom: passwordMismatch || passwordTooShort ? "6px" : "14px",
          border:
            "1px solid " +
            (passwordMismatch ? theme.red : passwordTooShort ? theme.warm : theme.border),
        }}
      />
      {passwordMismatch && (
        <p style={{ color: theme.red, fontSize: "12px", marginBottom: "10px", fontWeight: 600 }}>
          Adgangskoderne matcher ikke — tjek begge felter.
        </p>
      )}
      {!passwordMismatch && passwordTooShort && (
        <p style={{ color: theme.warm, fontSize: "12px", marginBottom: "10px", fontWeight: 600 }}>
          Adgangskoden skal være mindst 8 tegn.
        </p>
      )}
      <label htmlFor="onb-birth-year" style={labelStyle}>Fødselsår</label>
      <input id="onb-birth-year" value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="F.eks. 1995" type="text" inputMode="numeric" style={inputStyle} />
    </div>,

    <div key={1}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Dit padel-niveau</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vær ærlig — vi matcher dig bedre!</p>
      <div style={labelStyle}>Niveau</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
        {LEVELS.map(l => <button key={l} onClick={() => set("level", l)} style={selBtn(form.level === l)}>{l}</button>)}
      </div>
      <div style={labelStyle}>Spillestil</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {PLAY_STYLES.map(s => <button key={s} onClick={() => set("style", s)} style={{ ...selBtn(form.style === s) }}>{s}</button>)}
      </div>
    </div>,

    <div key={2}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Hvor og hvornår?</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg den region du primært spiller i — så kan andre finde dig.</p>
      <div style={labelStyle}>Region</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {REGIONS.map((r) => (
          <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "8px 14px", fontSize: "13px" }}>{r}</button>
        ))}
      </div>
      <div style={labelStyle}>Hvornår kan du spille?</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {AVAILABILITY.map(a => <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "8px 14px", fontSize: "13px" }}>{a}</button>)}
      </div>
    </div>,

    <div key={3}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Næsten færdig!</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg profilbillede og skriv lidt om dig.</p>
      <div style={labelStyle}>Profilbillede</div>
      <div style={{ marginBottom: "20px" }}>
        <AvatarPicker
          value={form.avatar}
          previewUrl={avatarPreviewUrl}
          onFileSelect={(file) => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(URL.createObjectURL(file));
            setAvatarFile(file);
          }}
          onEmojiSelect={(emoji) => {
            set("avatar", emoji);
            setAvatarFile(null);
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(null);
          }}
        />
      </div>
      <label htmlFor="onb-bio" style={labelStyle}>Kort bio</label>
      <textarea id="onb-bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="F.eks. 'Ny til padel, søger makkere...'" style={{ ...inputStyle, height: "80px", resize: "vertical" }} />
    </div>,
  ];

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text, paddingBottom: "max(96px, env(safe-area-inset-bottom))" }}>
      <div className="pm-auth-wide">
        <div style={{ display: "flex", gap: "6px", marginBottom: "32px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: "3px", borderRadius: "3px", background: i <= step ? theme.accent : theme.border, transition: "background 0.3s" }} />
          ))}
        </div>
        {steps[step]}
        {err && <p style={{ color: theme.red, fontSize: "13px", marginTop: "12px" }}>{err}</p>}
        <div className="pm-onboarding-actions">
          <button onClick={step > 0 ? () => setStep(s => s - 1) : () => navigate("/")} style={btn(false)}>← Tilbage</button>
          {step < 3
            ? <button onClick={() => canNext() && setStep(s => s + 1)} style={{ ...btn(true), opacity: canNext() ? 1 : 0.4 }}>Næste <ArrowRight size={15} /></button>
            : <button onClick={finish} disabled={submitting} style={btn(true)}>{submitting ? "Opretter..." : "Opret profil"}</button>
          }
        </div>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

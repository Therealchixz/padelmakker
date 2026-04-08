import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { REGIONS, AVAILABILITY, PLAY_STYLES, LEVELS } from '../lib/platformConstants';
import { sanitizeText } from '../lib/platformUtils';
import { validateFirstLastName } from '../lib/profileUtils';
import { ArrowRight } from 'lucide-react';

export function OnboardingPage({ onComplete }) {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", password: "", level: "", style: "", area: "", availability: [], bio: "", avatar: "🎾", birth_year: "" });
  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const canNext = () => {
    if (step === 0)
      return (
        validateFirstLastName(form.first_name, form.last_name).valid &&
        form.email.trim() &&
        form.password.trim() &&
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
      const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const levelNum = parseFloat(form.level.match(/\d+/)?.[0] || "5");
      await signUp(form.email.trim(), form.password, {
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
      <label style={labelStyle}>Fornavn</label>
      <input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" style={{ ...inputStyle, marginBottom: "10px" }} />
      <label style={labelStyle}>Efternavn</label>
      <input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" style={{ ...inputStyle, marginBottom: "6px" }} />
      <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "14px" }}>
        Begge felter skal udfyldes. Dobbeltnavne med bindestreg er ok (f.eks. Anne-Marie).
      </p>
      <label style={labelStyle}>Email</label>
      <input value={form.email}    onChange={e => set("email", e.target.value)}    placeholder="din@email.dk"      type="email"    style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Adgangskode</label>
      <input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mindst 8 tegn"     type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Fødselsår</label>
      <input value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="F.eks. 1995" type="text" inputMode="numeric" style={inputStyle} />
    </div>,

    <div key={1}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Dit padel-niveau</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vær ærlig — vi matcher dig bedre!</p>
      <label style={labelStyle}>Niveau</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
        {LEVELS.map(l => <button key={l} onClick={() => set("level", l)} style={selBtn(form.level === l)}>{l}</button>)}
      </div>
      <label style={labelStyle}>Spillestil</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {PLAY_STYLES.map(s => <button key={s} onClick={() => set("style", s)} style={{ ...selBtn(form.style === s) }}>{s}</button>)}
      </div>
    </div>,

    <div key={2}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Hvor og hvornår?</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg den region du primært spiller i — så kan andre finde dig.</p>
      <label style={labelStyle}>Region</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {REGIONS.map((r) => (
          <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "8px 14px", fontSize: "13px" }}>{r}</button>
        ))}
      </div>
      <label style={labelStyle}>Hvornår kan du spille?</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {AVAILABILITY.map(a => <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "8px 14px", fontSize: "13px" }}>{a}</button>)}
      </div>
    </div>,

    <div key={3}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Næsten færdig!</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg avatar og skriv lidt om dig.</p>
      <label style={labelStyle}>Avatar</label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {avatars.map(a => (
          <button key={a} onClick={() => set("avatar", a)} style={{ width: "48px", height: "48px", borderRadius: "50%", fontSize: "22px", border: form.avatar === a ? "2px solid " + theme.accent : "1px solid " + theme.border, background: form.avatar === a ? theme.accentBg : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>{a}</button>
        ))}
      </div>
      <label style={labelStyle}>Kort bio</label>
      <textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="F.eks. 'Ny til padel, søger makkere...'" style={{ ...inputStyle, height: "80px", resize: "vertical" }} />
    </div>,
  ];

  return (
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
    </div>
  );
}

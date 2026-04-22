import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { REGIONS, AVAILABILITY, DAYS_OF_WEEK, PLAY_STYLES, LEVELS, LEVEL_DESCS, COURT_SIDES, INTENTS } from '../lib/platformConstants';
import { sanitizeText } from '../lib/platformUtils';
import { validateFirstLastName } from '../lib/profileUtils';
import { isValidSignupEmail } from '../lib/validationHelpers';

import { savePendingAvatar, tagPendingAvatarEmail } from '../lib/avatarUpload';

import { AvatarPicker } from '../components/AvatarPicker';
import { ArrowRight } from 'lucide-react';

export function OnboardingPage() {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", password: "", password_confirm: "", level: "", style: "", court_side: "", area: "", city: "", availability: [], available_days: [], bio: "", avatar: "🎾", birth_year: "", birth_month: "", birth_day: "", intent_now: "", seeking_match: false, travel_willing: false });
  const [avatarFile, setAvatarFile]         = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const toggleDay   = (d) => setForm(f => ({ ...f, available_days: f.available_days.includes(d) ? f.available_days.filter(x => x !== d) : [...f.available_days, d] }));
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
        form.birth_year.length === 4 && form.birth_month !== "" && form.birth_day !== ""
      );
    if (step === 1) return form.level && form.style && form.court_side;
    if (step === 2) return form.area && form.availability.length > 0;
    return true;
  };

  const stepMeta = [
    { title: "Konto", hint: "Navn, email og adgangskode." },
    { title: "Niveau", hint: "Spilleniveau og spillestil." },
    { title: "Område", hint: "Område og tidspunkter du spiller." },
    { title: "Profil", hint: "Billede, bio og tjek før oprettelse." },
  ];
  const totalSteps = stepMeta.length;
  const activeStepMeta = stepMeta[step];
  const profilePreviewName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim() || "Dit navn";
  const profilePreviewLevel = [form.level, form.style, form.court_side].filter(Boolean).join(" - ") || "Niveau ikke valgt endnu";
  const profilePreviewLocation = [form.city.trim(), form.area].filter(Boolean).join(", ") || "Område ikke valgt endnu";
  const profilePreviewBio = form.bio.trim() || "Tilføj en kort bio, så andre bedre forstår hvem du er som makker.";

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
      const levelNum = parseFloat(form.level.match(/[\d.]+/)?.[0] || "3");
      /* Vent til data URL er skrevet (ellers mangler e-mail-tag → applyPendingAvatar ved login fejler) */
      if (avatarFile) {
        await savePendingAvatar(avatarFile);
      }
      tagPendingAvatarEmail(form.email.trim());
      await signUp(form.email.trim(), form.password, {
        full_name: sanitizeText(displayName),
        level: levelNum,
        play_style: form.style,
        court_side: form.court_side || null,
        area: form.area,
        city: form.city.trim() || null,
        availability: form.availability,
        available_days: form.available_days,
        bio: sanitizeText(form.bio),
        avatar: avatarFile ? "🎾" : form.avatar,
        birth_year: parseInt(form.birth_year, 10) || null,
        birth_month: form.birth_month ? parseInt(form.birth_month, 10) : null,
        birth_day: form.birth_day ? parseInt(form.birth_day, 10) : null,
        intent_now: form.intent_now || null,
        seeking_match: form.seeking_match,
        travel_willing: form.travel_willing,
        onboarding_completed: true,
      });

      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      /* Altid til login: undgå at blive på /opret eller auto-dashboard når der opstår en session */
      try { await signOut(); } catch { /* fortsæt til login alligevel */ }
      navigate('/opret/bekraeft-email', { replace: true, state: { email: form.email.trim() } });
    } catch (e) {
      setErr(e.message || "Kunne ikke oprette profil.");
    } finally {
      setSubmitting(false);
    }
  };

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
      <label style={labelStyle}>Fødselsdato</label>
      <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 90px", gap: "8px", marginBottom: "14px" }}>
        <select value={form.birth_day} onChange={e => set("birth_day", e.target.value)} style={{ ...inputStyle, paddingLeft: "10px", paddingRight: "4px" }}>
          <option value="">Dag</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}.</option>)}
        </select>
        <select value={form.birth_month} onChange={e => set("birth_month", e.target.value)} style={{ ...inputStyle, paddingLeft: "10px", paddingRight: "4px" }}>
          <option value="">Måned</option>
          {["Januar","Februar","Marts","April","Maj","Juni","Juli","August","September","Oktober","November","December"].map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="År" type="text" inputMode="numeric" style={{ ...inputStyle, paddingLeft: "10px" }} />
      </div>
    </div>,

    <div key={1}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Dit padel-niveau</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vær ærlig — vi matcher dig bedre!</p>

      {/* Niveau — beskrivelse vises kun for valgt */}
      <div style={labelStyle}>Niveau</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
        {LEVELS.map(l => {
          const active = form.level === l;
          return (
            <button key={l} onClick={() => set("level", l)} style={{
              textAlign: "left", padding: "10px 14px",
              borderRadius: "8px", border: "1.5px solid " + (active ? theme.accent : theme.border),
              background: active ? theme.accentBg : theme.surface,
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", flexDirection: "column", gap: active ? "4px" : 0,
              fontFamily: "inherit",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", color: active ? theme.accent : theme.text }}>{l}</span>
                {active && <span style={{ fontSize: "13px", color: theme.accent, fontWeight: 700 }}>✓</span>}
              </div>
              {active && (
                <span style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.45 }}>{LEVEL_DESCS[l]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Spillestil + Side på banen — 2 kolonner */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={labelStyle}>Spillestil</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {PLAY_STYLES.map(s => (
              <button key={s} onClick={() => set("style", s)} style={{
                padding: "9px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "1.5px solid " + (form.style === s ? theme.accent : theme.border),
                background: form.style === s ? theme.accentBg : theme.surface,
                color: form.style === s ? theme.accent : theme.text,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Side på banen</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {COURT_SIDES.map(s => (
              <button key={s} onClick={() => set("court_side", s)} style={{
                padding: "9px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "1.5px solid " + (form.court_side === s ? theme.accent : theme.border),
                background: form.court_side === s ? theme.accentBg : theme.surface,
                color: form.court_side === s ? theme.accent : theme.text,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Intention — 2×2 gitter */}
      <div style={labelStyle}>Hvad søger du primært? <span style={{ fontWeight: 400, color: "#8494A7" }}>(valgfri)</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {INTENTS.map(i => {
          const active = form.intent_now === i.value;
          return (
            <button key={i.value} onClick={() => set("intent_now", active ? "" : i.value)} style={{
              padding: "10px 12px", borderRadius: "10px", textAlign: "left",
              border: "1.5px solid " + (active ? theme.accent : theme.border),
              background: active ? theme.accentBg : theme.surface,
              cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px",
              fontFamily: "inherit",
            }}>
              <span style={{ fontWeight: 700, fontSize: "13px", color: active ? theme.accent : theme.text }}>{i.label}</span>
              <span style={{ fontSize: "11px", color: active ? theme.accent : theme.textMid, lineHeight: 1.35, opacity: 0.85 }}>{i.desc}</span>
            </button>
          );
        })}
      </div>
    </div>,

    <div key={2}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Hvor og hvornår?</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg region og by — så kan andre finde dig nemt.</p>
      <div style={labelStyle}>Region</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        {REGIONS.map((r) => (
          <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "8px 14px", fontSize: "13px" }}>{r}</button>
        ))}
      </div>
      <label htmlFor="onb-city" style={labelStyle}>By <span style={{ fontWeight: 400, color: "#8494A7" }}>(valgfri)</span></label>
      <input
        id="onb-city"
        value={form.city}
        onChange={e => set("city", e.target.value)}
        placeholder="F.eks. Aarhus, København, Aalborg..."
        style={{ ...inputStyle, marginBottom: "20px" }}
      />
      <div style={labelStyle}>Hvornår kan du spille?</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {AVAILABILITY.map(a => <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "8px 14px", fontSize: "13px" }}>{a}</button>)}
      </div>

      <div style={labelStyle}>Hvilke dage kan du typisk spille?</div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const active = form.available_days.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleDay(key)}
              style={{
                flex: 1,
                padding: "10px 2px",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "8px",
                border: "1.5px solid " + (active ? theme.accent : theme.border),
                background: active ? theme.accent : "#fff",
                color: active ? "#fff" : theme.textMid,
                cursor: "pointer",
                transition: "all 0.12s",
                minWidth: 0,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", borderRadius: "10px", padding: "14px 16px", border: "1px solid " + theme.border }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: theme.text }}>Søger kamp aktivt</div>
          <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>Vis mig i foreslåede makkere for andre</div>
        </div>
        <button
          onClick={() => set("seeking_match", !form.seeking_match)}
          style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", background: form.seeking_match ? theme.accent : theme.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}
        >
          <div style={{ position: "absolute", top: "3px", left: form.seeking_match ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </button>
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
          onFileSelect={async (file) => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(URL.createObjectURL(file));
            setAvatarFile(file);
            await savePendingAvatar(file);
          }}
          onEmojiSelect={(emoji) => {
            set("avatar", emoji);
            setAvatarFile(null);
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(null);
          }}
        />
      </div>
      <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "16px" }}>
        Billedet gemmes lokalt indtil du er logget ind (også hvis du åbner bekræftelses-link i en ny fane). Upload sker automatisk ved første login.
      </p>
      <label htmlFor="onb-bio" style={labelStyle}>Kort bio</label>
      <textarea id="onb-bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl kort hvad du søger i en makker" style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "18px" }} />
      <div style={{ border: "1px solid " + theme.border, borderRadius: "12px", background: theme.surfaceAlt, padding: "14px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase", color: theme.textLight, fontWeight: 700, marginBottom: "10px" }}>
          Forhåndsvisning af profil
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "1px solid " + theme.border, background: theme.surface, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            {avatarPreviewUrl
              ? <img src={avatarPreviewUrl} alt="Valgt profilbillede" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "22px", lineHeight: 1 }}>{form.avatar}</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text, lineHeight: 1.2 }}>{profilePreviewName}</div>
            <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "3px", lineHeight: 1.35 }}>{profilePreviewLevel}</div>
          </div>
        </div>
        <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.5, marginBottom: "6px" }}>
          {profilePreviewLocation}
        </div>
        <div style={{ fontSize: "13px", color: theme.text, lineHeight: 1.5 }}>
          {profilePreviewBio}
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text, paddingBottom: "max(96px, env(safe-area-inset-bottom))" }}>
      <div className="pm-auth-wide">
        <div style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: theme.textMid }}>
              Trin {step + 1} af {totalSteps}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.accent }}>
              {activeStepMeta.title}
            </span>
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            {stepMeta.map((meta, i) => (
              <div key={meta.title} style={{ flex: 1, height: "4px", borderRadius: "4px", background: i <= step ? theme.accent : theme.border, transition: "background 0.3s" }} />
            ))}
          </div>
          <div style={{ fontSize: "12px", color: theme.textLight, lineHeight: 1.45 }}>
            {activeStepMeta.hint}
          </div>
        </div>
        <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "14px", padding: "18px", marginBottom: "12px" }}>
          {steps[step]}
        </div>
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

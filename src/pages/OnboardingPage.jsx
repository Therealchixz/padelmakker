import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { splitDisplayName, oauthAvatarUrl } from '../lib/authOAuth';
import { OAuthButtons, AuthDivider } from '../components/OAuthButtons';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { font, theme } from '../lib/platformTheme';
import {
  obInput,
  obLabel,
  btnNavy,
  chipStyle,
  insetCard,
  whiteCard,
  circleBtn,
  topbarTitle,
  stepDot,
  screenHeading,
  screenSub,
  fieldHint,
} from '../lib/onboardingStyles';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { REGIONS, AVAILABILITY, DAYS_OF_WEEK, PLAY_STYLES, COURT_SIDES } from '../lib/platformConstants';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { PlaytomicLevelPicker } from '../components/PlaytomicLevelPicker';
import { sanitizeText } from '../lib/platformUtils';
import { validateFirstLastName, canAccessDashboard, isValidProfileRegion } from '../lib/profileUtils';
import { isPhoneVerificationExempt, fetchPhoneVerificationExemptFromServer } from '../lib/phoneVerification';
import { isValidSignupEmail, isValidSignupPhone, normalizePhoneToE164 } from '../lib/validationHelpers';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { mapUserFacingError } from '../lib/userFacingErrors';

import { savePendingAvatar, tagPendingAvatarEmail } from '../lib/avatarUpload';

import { AvatarPicker } from '../components/AvatarPicker';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { getTurnstileSiteKey, isTurnstileEnabled } from '../lib/turnstileConfig';
import { LEGAL_INFO } from '../lib/legalInfo';
import { ArrowRight, ArrowLeft, Check, ShieldCheck } from 'lucide-react';

/** Niveau-kort fra mockup'et (Onboarding · 2 Niveau) — klik sætter levelNumeric. */
const LEVEL_CARDS = [
  { num: '1.0', value: 1, title: 'Helt ny', desc: 'Har aldrig eller næsten aldrig spillet padel.' },
  { num: '2.0', value: 2, title: 'Begynder', desc: 'Kan holde bolden i gang i rolige dueller.' },
  { num: '3.0', value: 3, title: 'Øvet', desc: 'Spiller jævnligt, behersker glasvægge og lob.' },
  { num: '4.0', value: 4, title: 'Erfaren', desc: 'Taktisk spil, bandeja og kontrolleret tempo.' },
  { num: '5.0+', value: 5, title: 'Elite', desc: 'Turneringsspiller på højt niveau.' },
];

export function OnboardingPage() {
  const { signUpWithPhone, user, profile, profileLoading, updateProfile, refreshProfileQuiet } = useAuth();
  const oauthSession = Boolean(user);
  const [serverPhoneExempt, setServerPhoneExempt] = useState(null);
  const phoneExempt = isPhoneVerificationExempt(user, profile, serverPhoneExempt === true);
  const phoneExemptResolved =
    !oauthSession || serverPhoneExempt !== null || (!profileLoading && profile != null);
  const navigate = useNavigate();
  const ask = useConfirm();
  const onboardingTopRef = useRef(null);
  const turnstileSiteKey = getTurnstileSiteKey();
  const turnstileEnabled = isTurnstileEnabled();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [err, setErr]             = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", email_confirm: "", phone: "", password: "", password_confirm: "", levelNumeric: 3, style: "", court_side: "", area: "", city: "", availability: [], available_days: [], bio: "", avatar: "🎾", birth_year: "", birth_month: "", birth_day: "" });
  const [avatarFile, setAvatarFile]         = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  /** Undgå gentaget auto-spring fra trin 1 → 0 → 1 når brugeren går tilbage. */
  const didAutoSkipAccountStepRef = useRef(false);

  useEffect(() => {
    onboardingTopRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);

  useEffect(() => {
    if (user?.id) refreshProfileQuiet();
  }, [user?.id, refreshProfileQuiet]);

  useEffect(() => {
    didAutoSkipAccountStepRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!oauthSession || !user?.id) {
      setServerPhoneExempt(false);
      return;
    }
    let cancelled = false;
    void fetchPhoneVerificationExemptFromServer(supabase).then((exempt) => {
      if (!cancelled) setServerPhoneExempt(exempt);
    });
    return () => {
      cancelled = true;
    };
  }, [oauthSession, user?.id]);

  // Udfyld navn og fødselsdato fra DB-profil (fx efter tidligere forsøg eller admin-redigering)
  useEffect(() => {
    if (!profile) return;
    const full = String(profile.full_name || profile.name || '').trim();
    if (!full) return;
    const parts = full.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';
    setForm((f) => ({
      ...f,
      first_name: f.first_name.trim() ? f.first_name : first,
      last_name: f.last_name.trim() ? f.last_name : last,
      birth_year:
        f.birth_year.length === 4
          ? f.birth_year
          : profile.birth_year != null
            ? String(profile.birth_year)
            : f.birth_year,
      birth_month:
        f.birth_month !== ''
          ? f.birth_month
          : profile.birth_month != null
            ? String(profile.birth_month)
            : f.birth_month,
      birth_day:
        f.birth_day !== ''
          ? f.birth_day
          : profile.birth_day != null
            ? String(profile.birth_day)
            : f.birth_day,
    }));
  }, [profile]);

  useEffect(() => {
    if (!user || !profile || !phoneExemptResolved) return;
    if (
      canAccessDashboard(user, profile, {
        phoneExempt: phoneExempt || serverPhoneExempt === true,
      })
    ) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, phoneExempt, phoneExemptResolved, serverPhoneExempt, navigate]);

  useEffect(() => {
    if (!user) return;
    const { first, last } = splitDisplayName(user.user_metadata?.full_name || user.user_metadata?.name);
    const email = user.email || '';
    setForm((f) => ({
      ...f,
      first_name: f.first_name || first,
      last_name: f.last_name || last,
      email: f.email || email,
      email_confirm: f.email_confirm || email,
    }));
    const pic = oauthAvatarUrl(user);
    if (pic && !avatarPreviewUrl && !avatarFile) {
      setAvatarPreviewUrl(pic);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps -- prefill once per OAuth session

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
  const normalizedEmail = form.email.trim().toLowerCase();
  const normalizedEmailConfirm = form.email_confirm.trim().toLowerCase();
  const emailConfirmTouchedInvalid =
    form.email_confirm.trim().length > 0 && !isValidSignupEmail(form.email_confirm);
  const emailMismatch =
    form.email_confirm.trim().length > 0 &&
    normalizedEmail !== normalizedEmailConfirm;
  const phoneTouchedInvalid =
    form.phone.trim().length > 0 && !isValidSignupPhone(form.phone);

  const missingStepRequirements = (targetStep = step) => {
    const missing = [];

    if (targetStep === 0) {
      if (!validateFirstLastName(form.first_name, form.last_name).valid) missing.push("fornavn og efternavn");
      if (!oauthSession) {
        if (!isValidSignupEmail(form.email)) missing.push("gyldig email");
        if (!isValidSignupEmail(form.email_confirm) || normalizedEmail !== normalizedEmailConfirm) missing.push("email skrevet ens i begge felter");
        if (form.password.length < 8) missing.push("adgangskode på mindst 8 tegn");
        if (form.password !== form.password_confirm) missing.push("ens adgangskoder");
      }
      if (
        phoneExemptResolved &&
        !phoneExempt &&
        (!isValidSignupPhone(form.phone) || !normalizePhoneToE164(form.phone))
      ) {
        missing.push("gyldigt telefonnummer");
      }
      if (!(form.birth_year.length === 4 && form.birth_month !== "" && form.birth_day !== "")) missing.push("fødselsdato");
    }

    if (targetStep === 1) {
      if (form.levelNumeric == null || !Number.isFinite(Number(form.levelNumeric))) missing.push("niveau");
      if (!form.style) missing.push("spillestil");
      if (!form.court_side) missing.push("side på banen");
    }

    if (targetStep === 2) {
      if (!isValidProfileRegion(form.area)) missing.push("region");
      // Tilgængelighed er valgfri ved onboarding — kan altid sættes/ændres på profilen
    }

    if (targetStep === 3 && !acceptedTerms) {
      missing.push("accept af vilkår og privatlivspolitik");
    }

    return missing;
  };

  const canNext = () => {
    if (step < 3) return missingStepRequirements(step).length === 0;
    return true;
  };
  const missingRequirements = missingStepRequirements();

  const missingStepRequirementsRef = useRef(missingStepRequirements);
  missingStepRequirementsRef.current = missingStepRequirements;

  useEffect(() => {
    if (!phoneExemptResolved || !phoneExempt || step !== 0) return;
    if (didAutoSkipAccountStepRef.current) return;
    if (missingStepRequirementsRef.current(0).length > 0) return;
    didAutoSkipAccountStepRef.current = true;
    setStep(1);
  }, [
    phoneExemptResolved,
    phoneExempt,
    step,
    oauthSession,
    form.first_name,
    form.last_name,
    form.birth_year,
    form.birth_month,
    form.birth_day,
    form.email,
    form.email_confirm,
    form.password,
    form.password_confirm,
    form.phone,
  ]);

  const stepTitles = ["Opret profil", "Dit niveau", "Dit område", "Din profil"];
  const totalSteps = stepTitles.length;
  const numericLevel = Number(form.levelNumeric);
  const selectedLevelCard = !Number.isFinite(numericLevel)
    ? null
    : numericLevel < 2 ? 1 : numericLevel < 3 ? 2 : numericLevel < 4 ? 3 : numericLevel < 5 ? 4 : 5;

  const cancelOnboarding = async () => {
    if (submitting) return;

    const hasDraft = Boolean(
      form.first_name.trim() ||
      form.last_name.trim() ||
      form.email.trim() ||
      form.email_confirm.trim() ||
      form.phone.trim() ||
      form.password ||
      form.password_confirm ||
      form.levelNumeric != null ||
      form.style ||
      form.court_side ||
      form.area ||
      form.city.trim() ||
      form.availability.length > 0 ||
      form.available_days.length > 0 ||
      form.bio.trim() ||
      form.birth_year ||
      form.birth_month ||
      form.birth_day ||
      avatarFile ||
      avatarPreviewUrl
    );

    if (hasDraft) {
      const confirmed = await ask({
        message: "Vil du annullere oprettelsen? Dine indtastninger bliver ikke gemt.",
        confirmLabel: "Ja, annuller",
        cancelLabel: "Bliv her",
        danger: true,
      });
      if (!confirmed) return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
    }

    setAvatarFile(null);
    setErr("");
    navigate("/");
  };

  const finish = async () => {
    if (!acceptedTerms) {
      setErr("Du skal acceptere handelsbetingelser og privatlivspolitik for at oprette profil.");
      return;
    }
    if (!oauthSession && turnstileEnabled && !captchaToken) {
      setErr("Bekræft venligst, at du ikke er en robot.");
      return;
    }

    setSubmitting(true); setErr("");
    try {
      const nameCheck = validateFirstLastName(form.first_name, form.last_name);
      if (!nameCheck.valid) {
        setErr(nameCheck.message);
        return;
      }
      const normalizedPhone = phoneExempt ? '' : normalizePhoneToE164(form.phone);
      if (!phoneExempt && !normalizedPhone) {
        setErr("Indtast et gyldigt telefonnummer (fx 20112233 eller +4520112233).");
        return;
      }
      const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      if (!isValidProfileRegion(form.area)) {
        setErr("Vælg din region — by er valgfri.");
        return;
      }
      const levelNum = Number(form.levelNumeric);
      const profilePayload = {
        full_name: sanitizeText(displayName),
        name: sanitizeText(displayName),
        level: levelNum,
        play_style: form.style,
        court_side: form.court_side || null,
        area: form.area,
        city: form.city.trim() || null,
        availability: form.availability,
        available_days: form.available_days,
        bio: sanitizeText(form.bio),
        avatar: avatarFile ? "🎾" : (oauthAvatarUrl(user) || form.avatar),
        birth_year: parseInt(form.birth_year, 10) || null,
        birth_month: form.birth_month ? parseInt(form.birth_month, 10) : null,
        birth_day: form.birth_day ? parseInt(form.birth_day, 10) : null,
      };

      if (oauthSession) {
        if (avatarFile) await savePendingAvatar(avatarFile);
        await updateProfile(profilePayload);
        if (phoneExempt) {
          const { error: metaErr } = await supabase.auth.updateUser({
            data: {
              ...profilePayload,
              onboarding_completed: true,
              onboarding_applied_to_profile: true,
              phone_verification_required: false,
            },
          });
          if (metaErr) throw metaErr;
          if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl);
          navigate('/dashboard', { replace: true });
          return;
        }
        const { error: phoneErr } = await supabase.auth.updateUser({
          phone: normalizedPhone,
          data: {
            ...profilePayload,
            onboarding_completed: true,
            onboarding_applied_to_profile: true,
            signup_phone: normalizedPhone,
            phone_verification_required: true,
          },
        });
        if (phoneErr) throw phoneErr;
        if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl);
        navigate('/opret/bekraeft-telefon', {
          replace: true,
          state: { phone: normalizedPhone, email: user?.email || form.email.trim() },
        });
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
      if (!isValidSignupEmail(form.email_confirm)) {
        setErr("Gentag din e-mail i feltet Bekræft email.");
        return;
      }
      if (normalizedEmail !== normalizedEmailConfirm) {
        setErr("E-mailadresserne matcher ikke - tjek begge felter.");
        return;
      }
      if (avatarFile) {
        await savePendingAvatar(avatarFile);
      }
      tagPendingAvatarEmail(form.email.trim());
      await signUpWithPhone(
        normalizedPhone,
        form.password,
        form.email.trim(),
        {
          ...profilePayload,
          onboarding_completed: true,
        },
        turnstileEnabled ? captchaToken : ''
      );

      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      navigate('/opret/bekraeft-telefon', {
        replace: true,
        state: { phone: normalizedPhone, email: form.email.trim() },
      });
    } catch (e) {
      const raw = String(e?.message || '');
      const authMapped = mapAuthErrorMessage(raw, 'login');
      setErr(
        authMapped !== raw
          ? authMapped
          : mapUserFacingError(e, 'Kunne ikke oprette profil. Prøv igen.')
      );
      if (turnstileEnabled) setCaptchaResetNonce((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const errorText = { color: theme.red, fontSize: "12px", margin: "6px 0 0", fontWeight: 600, lineHeight: 1.45 };
  const fieldWrap = { marginBottom: "14px" };
  const inputBorder = (bad) => ({ border: `1.5px solid ${bad ? theme.red : theme.border}` });

  const steps = [
    /* ============ Trin 1 · Konto (mockup: Onboarding · 1 Konto) ============ */
    <div key={0}>
      <div style={{ textAlign: "center", padding: "0 8px 18px" }}>
        <div style={screenHeading}>Lad os lære dig at kende</div>
        <div style={screenSub}>Tre trin: profil → SMS → e-mail — derefter logger du ind</div>
      </div>
      {oauthSession ? (
        <div style={{ ...insetCard, marginBottom: "14px", fontSize: "12.5px", color: theme.textMid, lineHeight: 1.55 }}>
          Du er logget ind med <strong style={{ color: theme.text }}>{user?.email || "din konto"}</strong>. Udfyld resten af
          profilen herunder. Du skal stadig bekræfte telefon med SMS (og e-mail, hvis den ikke er bekræftet).
        </div>
      ) : (
        <>
          <OAuthButtons redirectPath="/opret" disabled={submitting} onError={setErr} />
          <p style={{ fontSize: "12px", color: theme.textLight, margin: "0 0 10px", lineHeight: 1.5, textAlign: "center" }}>
            Google sparer dig for adgangskode — SMS-bekræftelse kræves stadig.
          </p>
          <AuthDivider />
        </>
      )}
      <div style={fieldWrap}>
        <label htmlFor="onb-first-name" style={obLabel}>Navn</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            id="onb-first-name"
            autoComplete="given-name"
            value={form.first_name}
            onChange={e => set("first_name", e.target.value)}
            placeholder="Fornavn"
            style={{ ...obInput, flex: 1, minWidth: 0 }}
          />
          <input
            id="onb-last-name"
            aria-label="Efternavn"
            autoComplete="family-name"
            value={form.last_name}
            onChange={e => set("last_name", e.target.value)}
            placeholder="Efternavn"
            style={{ ...obInput, flex: 1, minWidth: 0 }}
          />
        </div>
      </div>
      {!oauthSession && (
        <>
          <div style={fieldWrap}>
            <label htmlFor="onb-email" style={obLabel}>E-mail</label>
            <input
              id="onb-email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="din@email.dk"
              type="email"
              autoComplete="email"
              style={{ ...obInput, ...inputBorder(emailTouchedInvalid) }}
            />
            {emailTouchedInvalid && (
              <p style={errorText}>Brug en gyldig e-mail med @ og domæne (fx navn@mail.dk).</p>
            )}
          </div>
          <div style={fieldWrap}>
            <label htmlFor="onb-email-confirm" style={obLabel}>Bekræft e-mail</label>
            <input
              id="onb-email-confirm"
              value={form.email_confirm}
              onChange={e => set("email_confirm", e.target.value)}
              placeholder="Gentag din e-mail"
              type="email"
              autoComplete="email"
              style={{ ...obInput, ...inputBorder(emailConfirmTouchedInvalid || emailMismatch) }}
            />
            {emailConfirmTouchedInvalid && (
              <p style={errorText}>Gentag din email i et gyldigt format.</p>
            )}
            {!emailConfirmTouchedInvalid && emailMismatch && (
              <p style={errorText}>Emails matcher ikke - tjek begge felter.</p>
            )}
          </div>
          <div style={fieldWrap}>
            <label htmlFor="onb-password" style={obLabel}>
              Adgangskode <span style={{ color: theme.textLight, fontWeight: 400 }}>(min. 8 tegn)</span>
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                id="onb-password"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Adgangskode"
                type="password"
                autoComplete="new-password"
                style={{ ...obInput, flex: 1, minWidth: 0 }}
              />
              <input
                id="onb-password-confirm"
                aria-label="Bekræft adgangskode"
                value={form.password_confirm}
                onChange={e => set("password_confirm", e.target.value)}
                placeholder="Gentag"
                type="password"
                autoComplete="new-password"
                style={{
                  ...obInput,
                  flex: 1,
                  minWidth: 0,
                  border: `1.5px solid ${passwordMismatch ? theme.red : passwordTooShort ? theme.warm : theme.border}`,
                }}
              />
            </div>
            {passwordMismatch && (
              <p style={errorText}>Adgangskoderne matcher ikke — tjek begge felter.</p>
            )}
            {!passwordMismatch && passwordTooShort && (
              <p style={{ ...errorText, color: theme.warm }}>Adgangskoden skal være mindst 8 tegn.</p>
            )}
          </div>
        </>
      )}
      <div style={fieldWrap}>
        <label htmlFor="onb-birth-day" style={obLabel}>Fødselsdag</label>
        <div style={{ display: "grid", gridTemplateColumns: "76px 1fr 90px", gap: "10px" }}>
          <select
            id="onb-birth-day"
            value={form.birth_day}
            onChange={e => set("birth_day", e.target.value)}
            style={{ ...obInput, padding: "12px 8px 12px 12px", color: form.birth_day ? theme.text : theme.textLight }}
          >
            <option value="">Dag</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}.</option>)}
          </select>
          <select
            aria-label="Måned"
            value={form.birth_month}
            onChange={e => set("birth_month", e.target.value)}
            style={{ ...obInput, padding: "12px 8px 12px 12px", color: form.birth_month ? theme.text : theme.textLight }}
          >
            <option value="">Måned</option>
            {["Januar","Februar","Marts","April","Maj","Juni","Juli","August","September","Oktober","November","December"].map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input
            aria-label="År"
            value={form.birth_year}
            onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="År"
            type="text"
            inputMode="numeric"
            style={{ ...obInput, padding: "12px 10px" }}
          />
        </div>
        <div style={fieldHint}>Bruges kun til aldersbekræftelse og vises ikke offentligt.</div>
      </div>
      {phoneExemptResolved && phoneExempt ? (
        <div style={{ ...insetCard, marginBottom: "14px", fontSize: "12.5px", color: theme.textMid, lineHeight: 1.55 }}>
          Denne konto er undtaget fra telefon-SMS (sat af admin). Du behøver ikke tilføje telefonnummer.
        </div>
      ) : phoneExemptResolved ? (
        <div style={fieldWrap}>
          <label htmlFor="onb-phone" style={obLabel}>Telefonnummer</label>
          <input
            id="onb-phone"
            value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder="Fx 20112233 eller +4520112233"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            style={{ ...obInput, ...inputBorder(phoneTouchedInvalid) }}
          />
          {phoneTouchedInvalid && (
            <p style={errorText}>Indtast et gyldigt telefonnummer (fx 20112233 eller +4520112233).</p>
          )}
        </div>
      ) : (
        <p style={{ color: theme.textMid, fontSize: "12.5px", marginBottom: "14px", lineHeight: 1.5 }}>
          Tjekker telefon-krav…
        </p>
      )}
      {phoneExemptResolved && !phoneExempt && (
        <div style={{ ...insetCard, fontSize: "11.5px", color: theme.textLight, lineHeight: 1.55 }}>
          {oauthSession
            ? "Dit telefonnummer bekræftes med en SMS-kode til sidst."
            : "Dit telefonnummer bekræftes med en SMS-kode, og din e-mail bekræftes med et link til sidst."}
        </div>
      )}
    </div>,

    /* ============ Trin 2 · Niveau (mockup: Onboarding · 2 Niveau) ============ */
    <div key={1}>
      <div style={{ textAlign: "center", padding: "0 8px 16px" }}>
        <div style={screenHeading}>Hvor godt spiller du?</div>
        <div style={screenSub}>Dit niveau bruges til at matche dig med spillere på samme niveau – din Elo justerer sig automatisk efter dine kampe</div>
      </div>
      {LEVEL_CARDS.map((c) => {
        const sel = selectedLevelCard === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => set("levelNumeric", c.value)}
            aria-pressed={sel}
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "13px",
              background: theme.surface,
              border: `1.5px solid ${sel ? theme.navy : theme.border}`,
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "11px",
              cursor: "pointer",
              fontFamily: font,
              boxShadow: sel ? "0 0 0 3px rgba(22, 55, 126, 0.12)" : "none",
              transition: "border-color 0.12s, box-shadow 0.12s",
            }}
          >
            <span
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                background: sel ? theme.navy : theme.surfaceAlt,
                color: sel ? "var(--pm-on-accent)" : theme.accent,
                fontWeight: 700,
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {c.num}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: theme.text }}>{c.title}</span>
              <span style={{ display: "block", fontSize: "11.5px", color: theme.textLight, lineHeight: 1.45, marginTop: "2px" }}>
                {c.desc}
              </span>
            </span>
            <span
              aria-hidden
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                flex: "none",
                border: sel ? "none" : `1.5px solid ${theme.border}`,
                background: sel ? theme.navy : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--pm-on-accent)",
              }}
            >
              {sel && <Check size={12} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setShowFineTune(v => !v)}
        style={{
          border: "none",
          background: "transparent",
          color: theme.accent,
          fontWeight: 600,
          fontSize: "12.5px",
          cursor: "pointer",
          padding: "4px 0",
          fontFamily: font,
        }}
      >
        {showFineTune
          ? "Skjul finjustering"
          : `Finjustér niveau (valgt: ${formatPlaytomicLevel(form.levelNumeric)})`}
      </button>
      {showFineTune && (
        <div style={{ marginTop: "10px" }}>
          <PlaytomicLevelPicker
            value={form.levelNumeric}
            onChange={(n) => set('levelNumeric', n)}
          />
        </div>
      )}
      <div style={{ marginTop: "14px" }}>
        <label htmlFor="onb-style" style={obLabel}>Spillestil</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            id="onb-style"
            value={form.style}
            onChange={e => set("style", e.target.value)}
            style={{ ...obInput, flex: 1, minWidth: 0, color: form.style ? theme.text : theme.textLight }}
          >
            <option value="">Spillestil…</option>
            {PLAY_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            aria-label="Side på banen"
            value={form.court_side}
            onChange={e => set("court_side", e.target.value)}
            style={{ ...obInput, flex: 1, minWidth: 0, color: form.court_side ? theme.text : theme.textLight }}
          >
            <option value="">Side på banen…</option>
            {COURT_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={fieldHint}>Spillestil og din foretrukne side på banen.</div>
      </div>
    </div>,

    /* ============ Trin 3 · Område (mockup: Onboarding · 3 Område) ============ */
    <div key={2}>
      <div style={fieldWrap}>
        <label style={obLabel}>Region</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {REGIONS.map((r) => (
            <button key={r} type="button" onClick={() => set("area", r)} style={chipStyle(form.area === r)}>{r}</button>
          ))}
        </div>
      </div>
      <div style={fieldWrap}>
        <label htmlFor="onb-city" style={obLabel}>
          By <span style={{ color: theme.textLight, fontWeight: 400 }}>(valgfri)</span>
        </label>
        <input
          id="onb-city"
          value={form.city}
          onChange={e => set("city", e.target.value)}
          placeholder="F.eks. Aarhus, København, Aalborg..."
          style={obInput}
        />
        <div style={fieldHint}>Byen er valgfri og kan tilføjes under profil senere.</div>
      </div>
      <div style={fieldWrap}>
        <label style={obLabel}>Hvornår kan du spille? <span style={{ fontWeight: 400, opacity: 0.7 }}>(valgfri)</span></label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {AVAILABILITY.map(a => (
            <button key={a} type="button" onClick={() => toggleAvail(a)} style={chipStyle(form.availability.includes(a))}>{a}</button>
          ))}
        </div>
      </div>
      <div style={fieldWrap}>
        <label style={obLabel}>Hvilke dage kan du typisk spille?</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {DAYS_OF_WEEK.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              style={chipStyle(form.available_days.includes(key), { padding: "8px 11px" })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>,

    /* ============ Trin 4 · Profil (mockup: Onboarding · 4 Profil) ============ */
    <div key={3}>
      <div style={{ textAlign: "center", padding: "4px 0 16px" }}>
        <div
          style={{
            width: "78px",
            height: "78px",
            borderRadius: "50%",
            margin: "0 auto",
            background: theme.surfaceAlt,
            border: `3px solid ${theme.surface}`,
            boxShadow: "0 2px 8px rgba(13,39,82,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {avatarPreviewUrl
            ? <img src={avatarPreviewUrl} alt="Valgt profilbillede" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "30px", lineHeight: 1 }}>{form.avatar}</span>}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: theme.accent, marginTop: "8px" }}>Vælg profilbillede</div>
        <div style={{ fontSize: "10.5px", color: theme.textLight, marginTop: "2px" }}>Emoji eller upload et billede</div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: theme.green, marginTop: "10px" }}>Din profil er klar til at finde makkere 🎾</div>
      </div>
      <div style={{ marginBottom: "10px" }}>
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
      <p style={{ ...fieldHint, marginTop: 0, marginBottom: "14px" }}>
        Billedet gemmes lokalt indtil du er logget ind (også hvis du åbner bekræftelses-link i en ny fane). Upload sker
        automatisk ved første login.
      </p>
      <div style={fieldWrap}>
        <label htmlFor="onb-bio" style={obLabel}>
          Kort bio <span style={{ color: theme.textLight, fontWeight: 400 }}>(valgfri)</span>
        </label>
        <textarea
          id="onb-bio"
          value={form.bio}
          onChange={e => set("bio", e.target.value)}
          placeholder="Fortæl kort om dig som spiller"
          style={{ ...obInput, height: "74px", resize: "vertical" }}
        />
      </div>
      <label
        style={{
          ...whiteCard,
          display: "flex",
          alignItems: "flex-start",
          gap: "11px",
          padding: "13px 15px",
          marginBottom: "12px",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: "1px", height: "1px" }}
        />
        <span
          aria-hidden
          style={{
            width: "21px",
            height: "21px",
            borderRadius: "6px",
            flex: "none",
            marginTop: "1px",
            border: acceptedTerms ? "none" : `1.5px solid ${theme.border}`,
            background: acceptedTerms ? theme.navy : theme.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--pm-on-accent)",
          }}
        >
          {acceptedTerms && <Check size={13} strokeWidth={3} />}
        </span>
        <span style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.5 }}>
          Jeg accepterer {LEGAL_INFO.brand}s{" "}
          <Link to="/handelsbetingelser" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, fontWeight: 600 }}>
            handelsbetingelser
          </Link>{" "}
          og{" "}
          <Link to="/privatlivspolitik" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, fontWeight: 600 }}>
            privatlivspolitik
          </Link>
          , og bekræfter at jeg er mindst {LEGAL_INFO.minAgeYears} år.
        </span>
      </label>
      {turnstileEnabled && (
        <div style={{ ...insetCard, marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <ShieldCheck size={16} style={{ color: captchaToken ? theme.green : theme.accent, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: theme.textMid, flex: 1 }}>
              {captchaToken ? "Sikkerhedscheck gennemført" : "Sikkerhedscheck — bekræft at du ikke er en robot"}
            </span>
            {captchaToken && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: theme.greenBg,
                  color: theme.green,
                  flex: "none",
                }}
              >
                ✓
              </span>
            )}
          </div>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onTokenChange={setCaptchaToken}
            resetNonce={captchaResetNonce}
          />
        </div>
      )}
    </div>,
  ];

  const nextDisabled = step < 3 ? !canNext() : (submitting || !acceptedTerms || (!oauthSession && turnstileEnabled && !captchaToken));

  return (
    <div
      ref={onboardingTopRef}
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: "100dvh",
        color: theme.text,
        paddingTop: "max(10px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(96px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="pm-auth-wide" style={{ paddingTop: "10px" }}>
        {/* Topbar (mockup .topbar) */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "6px 0 12px" }}>
          <button
            type="button"
            onClick={step > 0 ? () => setStep(s => s - 1) : cancelOnboarding}
            aria-label={step > 0 ? "Tilbage" : "Annuller oprettelse"}
            style={circleBtn}
          >
            <ArrowLeft size={18} strokeWidth={2.2} />
          </button>
          <h2 style={topbarTitle}>{stepTitles[step]}</h2>
          <button
            type="button"
            onClick={cancelOnboarding}
            style={{
              border: "none",
              background: "transparent",
              color: theme.textLight,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
              fontFamily: font,
            }}
          >
            Annuller
          </button>
        </div>
        {/* Trin-indikator (mockup .steps / .step-dot) */}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step + 1}
          aria-label={`Trin ${step + 1} af ${totalSteps}`}
          style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "4px 0 14px" }}
        >
          {stepTitles.map((t, i) => (
            <div key={t} style={stepDot(i <= step)} />
          ))}
        </div>

        {steps[step]}

        {err && (
          <p style={{ color: theme.red, fontSize: "12.5px", fontWeight: 600, lineHeight: 1.5, marginTop: "14px" }}>{err}</p>
        )}
        {step < 3 && missingRequirements.length > 0 && (
          <div
            aria-live="polite"
            style={{
              ...insetCard,
              marginTop: "14px",
              color: theme.textMid,
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: 1.45,
            }}
          >
            Mangler før du kan fortsætte: {missingRequirements.join(", ")}.
          </div>
        )}

        <div style={{ padding: "18px 0 0" }}>
          {step < 3 ? (
            <button
              type="button"
              disabled={nextDisabled}
              onClick={() => canNext() && setStep(s => s + 1)}
              style={{ ...btnNavy, opacity: nextDisabled ? 0.45 : 1, cursor: nextDisabled ? "not-allowed" : "pointer" }}
            >
              Fortsæt <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={nextDisabled}
              style={{ ...btnNavy, opacity: nextDisabled ? 0.45 : 1, cursor: nextDisabled ? "not-allowed" : "pointer" }}
            >
              {submitting ? "Opretter..." : "Opret profil"} <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <PublicLegalFooter />
      </div>
    </div>
  );
}


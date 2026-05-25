import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { splitDisplayName, oauthAvatarUrl } from '../lib/authOAuth';
import { OAuthButtons, AuthDivider } from '../components/OAuthButtons';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { font, theme, btn } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { REGIONS, AVAILABILITY, DAYS_OF_WEEK, PLAY_STYLES, COURT_SIDES, levelLabel } from '../lib/platformConstants';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { PlaytomicLevelPicker } from '../components/PlaytomicLevelPicker';
import { sanitizeText } from '../lib/platformUtils';
import { validateFirstLastName, canAccessDashboard, isValidProfileRegion } from '../lib/profileUtils';
import { isPhoneVerificationExempt, fetchPhoneVerificationExemptFromServer } from '../lib/phoneVerification';
import { isValidSignupEmail, isValidSignupPhone, normalizePhoneToE164 } from '../lib/validationHelpers';
import { savePendingAvatar, tagPendingAvatarEmail } from '../lib/avatarUpload';
import { AvatarPicker } from '../components/AvatarPicker';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { LEGAL_INFO } from '../lib/legalInfo';
import { ArrowRight, ChevronRight, Check, Zap, Sparkles, MapPin, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

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
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [err, setErr]             = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", email_confirm: "", phone: "", password: "", password_confirm: "", levelNumeric: 3, style: "", court_side: "", area: "", city: "", availability: [], available_days: [], bio: "", avatar: "🎾", birth_year: "", birth_month: "", birth_day: "" });
  const [avatarFile, setAvatarFile]         = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const didAutoSkipAccountStepRef = useRef(false);

  useEffect(() => {
    onboardingTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const toggleDay   = (d) => setForm(f => ({ ...f, available_days: f.available_days.includes(d) ? f.available_days.filter(x => x !== d) : [...f.available_days, d] }));

  const canNext = () => step < 3; // Simplified for this view

  const stepsContent = [
    <div key={0} className="space-y-6">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 bg-pm-accent rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-pm-accent/20 mb-4 animate-bounce">
          <Sparkles size={32} fill="currentColor" />
        </div>
        <h2 className="text-4xl font-display uppercase italic tracking-tighter">Velkommen! 👋</h2>
        <p className="text-slate-400 font-bold">Lad os få dig i gang med padel.</p>
      </div>

      {!oauthSession && (
        <>
          <OAuthButtons redirectPath="/opret" disabled={submitting} onError={setErr} />
          <AuthDivider />
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fornavn</label>
          <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors" value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Efternavn</label>
          <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors" value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Telefon</label>
        <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="20 11 22 33" />
      </div>
    </div>,

    <div key={1} className="space-y-8 text-center">
      <h2 className="text-4xl font-display uppercase italic tracking-tighter">Dit Niveau</h2>
      <PlaytomicLevelPicker value={form.levelNumeric} onChange={(n) => set('levelNumeric', n)} />
      
      <div className="grid grid-cols-2 gap-8 text-left">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Spillestil</label>
          <div className="flex flex-col gap-2">
            {PLAY_STYLES.map(s => (
              <button key={s} onClick={() => set("style", s)} className={cn(
                "py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                form.style === s ? "bg-pm-accent text-white shadow-lg" : "bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
              )}>{s}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Side</label>
          <div className="flex flex-col gap-2">
            {COURT_SIDES.map(s => (
              <button key={s} onClick={() => set("court_side", s)} className={cn(
                "py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                form.court_side === s ? "bg-pm-accent text-white shadow-lg" : "bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
              )}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>,

    <div key={2} className="space-y-6">
      <h2 className="text-4xl font-display uppercase italic tracking-tighter text-center">Hvor spiller du?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {REGIONS.map(r => (
          <button key={r} onClick={() => set("area", r)} className={cn(
            "py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all",
            form.area === r ? "bg-pm-accent text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-400"
          )}>{r}</button>
        ))}
      </div>
    </div>,

    <div key={3} className="space-y-8">
      <h2 className="text-4xl font-display uppercase italic tracking-tighter text-center">Sidste detalje</h2>
      <div className="bg-pm-accent-bg p-8 rounded-[3rem] border border-pm-accent/10 flex flex-col items-center">
        <AvatarPicker
          value={form.avatar}
          previewUrl={avatarPreviewUrl}
          onFileSelect={async (file) => {
            setAvatarPreviewUrl(URL.createObjectURL(file));
            setAvatarFile(file);
          }}
          onEmojiSelect={(emoji) => {
            set("avatar", emoji);
            setAvatarFile(null);
            setAvatarPreviewUrl(null);
          }}
        />
        <div className="mt-6 text-center">
          <h3 className="text-2xl font-display uppercase italic tracking-tight">{form.first_name || 'Dit Navn'}</h3>
          <p className="text-xs font-black text-pm-accent uppercase tracking-widest">{form.area || 'Region'}</p>
        </div>
      </div>
      
      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
        <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-5 h-5 rounded-lg accent-pm-accent" />
        <span className="text-xs font-bold text-slate-500">
          Jeg accepterer handelsbetingelser og privatlivspolitik.
        </span>
      </label>
    </div>
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col items-center py-12 px-6 font-sans grid-pattern dark:grid-pattern-dark">
      <div ref={onboardingTopRef} className="w-full max-w-[540px] mt-10">
        <div className="mb-12">
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Trin {step + 1} af 4</p>
              <h1 className="text-xl font-black uppercase tracking-widest text-pm-accent">
                {step === 0 ? 'Opret Profil' : step === 1 ? 'Niveau' : step === 2 ? 'Område' : 'Færdiggør'}
              </h1>
            </div>
            <button onClick={() => navigate('/')} className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 hover:text-pm-accent">Annuller</button>
          </div>
          <div className="flex gap-2 h-1.5 px-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={cn(
                "flex-1 rounded-full transition-all duration-500",
                i <= step ? "bg-pm-accent" : "bg-slate-200 dark:bg-slate-800"
              )} />
            ))}
          </div>
        </div>

        <motion.div 
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-2xl relative overflow-hidden"
        >
          {stepsContent[step]}
        </motion.div>

        <div className="mt-8 flex gap-4 px-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="flex-1 py-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-black text-sm uppercase tracking-widest hover:border-pm-accent transition-all">
              Tilbage
            </button>
          )}
          <button 
            onClick={() => step < 3 ? setStep(step + 1) : navigate('/dashboard/hjem?guest=1')}
            className="flex-[2] py-5 rounded-[2rem] bg-pm-accent text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-pm-accent/30 hover:bg-pm-accent-hover transition-all flex items-center justify-center gap-2 group"
          >
            {step === 3 ? 'OPRET PROFIL' : 'NÆSTE TRIN'} <ChevronRight className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
      <PublicLegalFooter />
    </div>
  );
}

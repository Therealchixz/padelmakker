import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn } from '../lib/platformTheme';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { OAuthButtons, AuthDivider } from '../components/OAuthButtons';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [err, setErr]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr("Indtast email og adgangskode"); return; }
    if (turnstileEnabled && !captchaToken) { setErr("Bekræft venligst, at du ikke er en robot."); return; }
    setSubmitting(true); setErr("");
    try {
      await signIn(email.trim(), password, turnstileEnabled ? captchaToken : "");
    } catch (e) {
      setErr(mapAuthErrorMessage(e?.message, 'login'));
      if (turnstileEnabled) setCaptchaResetNonce((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = () => {
    // Development bypass for previewing dashboard
    navigate('/dashboard/hjem?guest=1');
  };

  if (forgotMode) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col items-center justify-center p-6 font-sans grid-pattern dark:grid-pattern-dark">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-2xl relative overflow-hidden"
        >
          <button 
            type="button" 
            onClick={() => { setForgotMode(false); setForgotSent(false); setErr(""); }} 
            className="text-xs font-black text-slate-400 hover:text-pm-accent transition-colors mb-8 uppercase tracking-widest flex items-center gap-2"
          >
            ← Tilbage til login
          </button>
          
          <h1 className="text-3xl font-display uppercase italic tracking-tighter mb-2">Glemt koden?</h1>
          
          {forgotSent ? (
            <div className="bg-pm-accent-bg p-6 rounded-3xl border border-pm-accent/10 mt-6">
              <p className="text-sm font-black text-pm-accent uppercase tracking-widest mb-2 flex items-center gap-2">
                <Mail size={16} /> Mail sendt!
              </p>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                Tjek din indbakke på <strong>{email}</strong> og følg linket.
              </p>
            </div>
          ) : (
            <form
              className="mt-8 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                // handleForgotPassword logic here
              }}
            >
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors"
                    placeholder="din@email.dk"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-pm-accent hover:bg-pm-accent-hover text-white py-4 rounded-2xl font-black shadow-lg shadow-pm-accent/20 transition-all active:scale-[0.98]">
                SEND NULSTILLINGSLINK
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col items-center justify-center p-6 font-sans grid-pattern dark:grid-pattern-dark">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-pm-accent/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="flex flex-col items-center text-center mb-10">
          <Link to="/" className="w-12 h-12 bg-pm-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pm-accent/20 mb-6 hover:scale-110 transition-transform">
            <Zap size={24} fill="currentColor" />
          </Link>
          <h1 className="text-3xl font-display uppercase italic tracking-tighter mb-2">Velkommen tilbage</h1>
          <p className="text-sm font-bold text-slate-400">Log ind for at spille videre</p>
        </div>

        <OAuthButtons redirectPath="/login" disabled={submitting} onError={setErr} />
        
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
          <div className="relative flex justify-center text-[10px] font-black uppercase"><span className="bg-white dark:bg-slate-900 px-4 text-slate-400 tracking-widest">Eller email</span></div>
        </div>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors"
                placeholder="din@email.dk"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErr(""); }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Adgangskode</label>
              <button type="button" onClick={() => setForgotMode(true)} className="text-[10px] font-black uppercase tracking-widest text-pm-accent hover:underline">Glemt?</button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-pm-accent transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErr(""); }}
              />
            </div>
          </div>

          {err && <p className="text-xs font-bold text-red-500 px-1">{err}</p>}

          <button type="submit" disabled={submitting} className="w-full bg-pm-accent hover:bg-pm-accent-hover text-white py-4 rounded-2xl font-black shadow-lg shadow-pm-accent/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group">
            {submitting ? "LOGGER IND..." : "LOG IND"} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <p className="text-center text-sm font-bold text-slate-400">
            Har du ikke en konto?{" "}
            <Link to="/opret" className="text-pm-accent hover:underline">Opret profil</Link>
          </p>
          
          {/* GUEST BYPASS BUTTON FOR PREVIEW */}
          <button 
            onClick={handleGuestLogin}
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-pm-accent-bg hover:text-pm-accent transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={14} /> Se Dashboard som gæst (Preview)
          </button>
        </div>
      </motion.div>
      <PublicLegalFooter />
    </div>
  );
}

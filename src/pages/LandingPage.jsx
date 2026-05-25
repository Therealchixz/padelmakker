import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight, Users, Trophy, Swords, MapPin, 
  ChevronRight, Calendar, Sparkles, Zap, Shield, 
  MessageSquare, LayoutGrid, Sun, Moon, Menu, X
} from 'lucide-react';
import { useDarkMode } from '../lib/useDarkMode';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isGuestPreview = new URLSearchParams(location.search).get("guest") === "1";
  const { session } = useAuth();
  const hasSession = session || isGuestPreview;
  const [dark, setDark] = useDarkMode();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans selection:bg-pm-accent selection:text-white",
      dark ? "bg-[#020617] text-white grid-pattern-dark" : "bg-[#f8fafc] text-slate-900 grid-pattern"
    )}>
      {/* Floating Island Header */}
      <header className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 w-[95%] max-w-5xl",
        isScrolled 
          ? "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800 py-3 rounded-2xl shadow-2xl" 
          : "bg-transparent py-6"
      )}>
        <div className="px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-pm-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-pm-accent/20 group-hover:scale-110 transition-transform">
              <Zap size={22} fill="currentColor" />
            </div>
            <span className="font-display uppercase italic text-2xl tracking-tighter">PadelMakker</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/events" className="text-sm font-bold text-slate-500 hover:text-pm-accent transition-colors">Events</Link>
            <Link to="/hjaelp" className="text-sm font-bold text-slate-500 hover:text-pm-accent transition-colors">Hjælp</Link>
            <Link to="/app" className="text-sm font-bold text-slate-500 hover:text-pm-accent transition-colors">App</Link>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDark(!dark)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            {hasSession ? (
              <button 
                onClick={() => navigate('/dashboard/hjem?guest=1')}
                className="bg-pm-accent hover:bg-pm-accent-hover text-white px-5 py-2 rounded-xl text-sm font-black transition-all shadow-lg shadow-pm-accent/25"
              >
                DASHBOARD
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/login')}
                  className="hidden sm:block px-4 py-2 text-sm font-bold text-slate-500 hover:text-pm-accent"
                >
                  Log ind
                </button>
                <button 
                  onClick={() => navigate('/opret')}
                  className="bg-pm-accent hover:bg-pm-accent-hover text-white px-5 py-2 rounded-xl text-sm font-black transition-all shadow-lg shadow-pm-accent/25"
                >
                  OPRET PROFIL
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="hero-glow" />
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pm-accent-bg text-pm-accent text-[10px] font-black uppercase tracking-widest mb-8 border border-pm-accent/10"
          >
            <Sparkles size={14} /> Nu med Americano ELO
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl lg:text-[120px] font-display uppercase italic tracking-tighter leading-[0.85] mb-8"
          >
            Spil mere <span className="text-gradient">padel.</span><br />
            Find din <span className="underline decoration-pm-orange underline-offset-8">makker.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-2xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12 font-bold leading-relaxed"
          >
            PadelMakker er Danmarks mest moderne platform for padel-spillere. 
            Find makkere på dit niveau, book baner og følg din ELO-udvikling.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {hasSession ? (
              <button 
                onClick={() => navigate('/dashboard/hjem?guest=1')}
                className="w-full sm:w-auto bg-pm-accent hover:bg-pm-accent-hover text-white px-8 py-5 rounded-2xl text-lg font-black transition-all shadow-[0_20px_40px_-10px_rgba(0,118,182,0.4)] flex items-center justify-center gap-2 group"
              >
                GÅ TIL DASHBOARD <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button 
                onClick={() => navigate('/opret')}
                className="w-full sm:w-auto bg-pm-accent hover:bg-pm-accent-hover text-white px-8 py-5 rounded-2xl text-lg font-black transition-all shadow-[0_20px_40px_-10px_rgba(0,118,182,0.4)] flex items-center justify-center gap-2 group"
              >
                KOM I GANG NU <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
            <Link 
              to="/elo"
              className="w-full sm:w-auto px-8 py-5 rounded-2xl text-lg font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-pm-accent transition-all flex items-center justify-center gap-2"
            >
              SE HVORDAN ELO VIRKER
            </Link>
          </motion.div>
        </div>

        {/* Floating Stats */}
        <div className="max-w-7xl mx-auto mt-32 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: 'Aktive spillere', value: '5.000+', icon: Users },
            { label: 'Kampe spillet', value: '12k', icon: Swords },
            { label: 'Gns. rating', value: '1540', icon: Trophy },
            { label: 'Ledige baner', value: '24/7', icon: MapPin },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-sm"
            >
              <div className="w-10 h-10 bg-pm-accent-bg rounded-xl flex items-center justify-center text-pm-accent mx-auto mb-4">
                <stat.icon size={20} />
              </div>
              <p className="text-3xl font-display uppercase tracking-tight italic mb-1">{stat.value}</p>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-6xl font-display uppercase italic tracking-tighter mb-4">Alt samlet på <span className="text-pm-accent">ét sted</span></h2>
            <p className="text-slate-500 font-bold max-w-xl mx-auto">Bygget af padel-entusiaster til padel-entusiaster. En moderne oplevelse uden unødigt støj.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 grid-rows-2 gap-4">
            {/* Feature 1: ELO */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-4 bg-gradient-to-br from-pm-accent to-[#005fa3] rounded-[2.5rem] p-8 text-white relative overflow-hidden group border border-white/10 shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-125 transition-transform duration-700" />
              <Shield className="mb-6 opacity-80" size={40} />
              <h3 className="text-4xl font-display uppercase italic mb-4">Avanceret ELO-system</h3>
              <p className="text-white/80 font-bold text-lg max-w-md">Vores algoritme sikrer at du altid finder makkere og modstandere der matcher dit niveau præcist.</p>
              <div className="mt-8 flex gap-4">
                <div className="px-4 py-2 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest">2v2 Rating</div>
                <div className="px-4 py-2 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest">Americano Rating</div>
              </div>
            </motion.div>

            {/* Feature 2: Chat */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-pm-orange rounded-[2.5rem] p-8 text-white flex flex-col justify-between border border-white/10 shadow-2xl"
            >
              <MessageSquare size={40} className="opacity-80" />
              <div>
                <h3 className="text-3xl font-display uppercase italic mb-2 text-white">Direkte Chat</h3>
                <p className="text-white/80 font-bold text-sm">Aftal tidspunkter og koordinér kampe direkte i appen.</p>
              </div>
            </motion.div>

            {/* Feature 3: Venue Search */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-xl"
            >
              <MapPin size={40} className="text-pm-accent" />
              <div>
                <h3 className="text-3xl font-display uppercase italic mb-2">Baner-overblik</h3>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Se ledige tider hos alle de største padelcentre i Aalborg og omegn.</p>
              </div>
            </motion.div>

            {/* Feature 4: Dashboard */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-4 bg-slate-900 dark:bg-white dark:text-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl"
            >
              <div className="flex justify-between items-start">
                <LayoutGrid size={40} className="opacity-80" />
                <div className="w-12 h-12 rounded-full border border-white/20 dark:border-slate-200 flex items-center justify-center">
                  <ArrowRight size={20} />
                </div>
              </div>
              <div className="mt-20">
                <h3 className="text-4xl font-display uppercase italic mb-4">Dit Personlige Dashboard</h3>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-lg max-w-md">Få det fulde overblik over dine statistikker, kommende kampe og makker-invitationer.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modern CTA */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto rounded-[3rem] bg-pm-accent p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <h2 className="text-5xl md:text-7xl font-display uppercase italic tracking-tighter mb-8 relative z-10">Klar til din <span className="text-slate-900 underline underline-offset-8">næste kamp?</span></h2>
          {hasSession ? (
            <button 
              onClick={() => navigate('/dashboard/hjem?guest=1')}
              className="bg-white text-pm-accent px-10 py-6 rounded-2xl text-xl font-black transition-all hover:scale-105 shadow-2xl relative z-10"
            >
              GÅ TIL DASHBOARD
            </button>
          ) : (
            <button 
              onClick={() => navigate('/opret')}
              className="bg-white text-pm-accent px-10 py-6 rounded-2xl text-xl font-black transition-all hover:scale-105 shadow-2xl relative z-10"
            >
              OPRET DIN PROFIL GRATIS
            </button>
          )}
          <p className="mt-8 text-white/70 font-bold relative z-10 uppercase tracking-widest text-xs italic">Tager under 2 minutter</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-pm-accent rounded-lg flex items-center justify-center text-white">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="font-display uppercase italic text-xl tracking-tighter">PadelMakker</span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 font-bold max-w-sm">
              Fællesskabet for padelspillere i Aalborg. Vi hjælper dig med at finde makkere, kampe og baner.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Navigation</h4>
            <ul className="space-y-4 font-bold">
              <li><Link to="/events" className="text-slate-500 hover:text-pm-accent transition-colors">Events</Link></li>
              <li><Link to="/hjaelp" className="text-slate-500 hover:text-pm-accent transition-colors">Hjælp & Support</Link></li>
              <li><Link to="/app" className="text-slate-500 hover:text-pm-accent transition-colors">App Installation</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Juridisk</h4>
            <ul className="space-y-4 font-bold">
              <li><Link to="/privatlivspolitik" className="text-slate-500 hover:text-pm-accent transition-colors">Privatlivspolitik</Link></li>
              <li><Link to="/handelsbetingelser" className="text-slate-500 hover:text-pm-accent transition-colors">Handelsbetingelser</Link></li>
              <li><Link to="/cookies" className="text-slate-500 hover:text-pm-accent transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-100 dark:border-slate-800 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          © 2026 PadelMakker Aalborg. Alle rettigheder forbeholdes.
        </div>
      </footer>
    </div>
  );
}

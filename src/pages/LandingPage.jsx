import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { useScrollReveal } from '../lib/platformUtils';
import { UserPlus, Users, MapPin, TrendingUp, Trophy, Swords, MessageCircle, Medal, MapPinned, LineChart, ArrowRight, CalendarDays, LifeBuoy, Smartphone, Menu, X, Sun, Moon, Mail, Info, CircleHelp } from 'lucide-react';
import { AnimatedAppMockup } from '../components/AnimatedAppMockup';
import { LandingEloExplainer } from '../components/LandingEloExplainer';
import { LandingTourVideo } from '../components/LandingTourVideo';
import { useDarkMode } from '../lib/useDarkMode';

export function LandingPage() {
  const revealRef = useScrollReveal();
  const heroRef = useRef(null);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [navHeight, setNavHeight] = useState(0);
  const toggleTheme = () => setDark((isDark) => !isDark);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const maxExtra = 100;
    const fadeStart = 24;
    const fadeRange = 200;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const t = Math.max(0, Math.min(1, (y - fadeStart) / fadeRange));
      el.style.setProperty("--pm-hero-fade-extra", `${Math.round(t * maxExtra)}px`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;

    const updateNavHeight = () => {
      const next = Math.ceil(navEl.getBoundingClientRect().height);
      setNavHeight((prev) => (prev === next ? prev : next));
    };

    updateNavHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateNavHeight);
      observer.observe(navEl);
      window.addEventListener("resize", updateNavHeight);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", updateNavHeight);
      };
    }

    window.addEventListener("resize", updateNavHeight);
    return () => window.removeEventListener("resize", updateNavHeight);
  }, []);

  const steps = [
    { step: "01", icon: <UserPlus  size={24} color={theme.onAccent} />, title: "Opret profil", desc: "Vælg niveau, region, spillestil og dine foretrukne spilledage — så kan andre finde dig rigtigt." },
    { step: "02", icon: <Users     size={24} color={theme.onAccent} />, title: "Find makker",  desc: "Se padelspillere nær dig på samme niveau, og invitér dem til en kamp uden Facebook-tråde." },
    { step: "03", icon: <MapPin    size={24} color={theme.onAccent} />, title: "Book bane",    desc: "Få overblik over ledige tider hos udvalgte centre, og hop videre til booking når tidspunktet passer." },
    { step: "04", icon: <TrendingUp size={24} color={theme.onAccent} />, title: "Følg din ELO", desc: "Registrér resultater, følg udviklingen og find mere jævnbyrdige kampe næste gang." },
  ];

  const features = [
    { icon: <Trophy size={22} color={theme.accent} />, title: "ELO-ranking", desc: "Avanceret ranking-system der matcher dig med jævnbyrdige spillere baseret på niveau, region og spilledage." },
    { icon: <Swords size={22} color={theme.accent} />, title: "Holdkampe", desc: "Opret åbne eller lukkede 2v2 kampe. Åbne kampe kan alle tilslutte sig direkte — lukkede kræver godkendelse fra opretteren." },
    { icon: <Medal size={22} color={theme.accent} />, title: "Americano", desc: "Opret turneringer med automatisk rundeplan, fair rotation og stilling — et format for sig, uden at det påvirker din ELO." },
    { icon: <MapPinned size={22} color={theme.accent} />, title: "Ledige baner", desc: "Se live ledige tider hos udvalgte centre og hop direkte videre til booking, når du har fundet et tidspunkt." },
    { icon: <MessageCircle size={22} color={theme.accent} />, title: "Direkte beskeder", desc: "Chat direkte med andre spillere i appen — aftale kamp, koordinér tider og hold kontakten med dine faste makkere." },
    { icon: <LineChart size={22} color={theme.accent} />, title: "Profil & udvikling", desc: "Følg din ELO over tid, se sejrsstreaks, bedste makker og kamphistorik — alt på ét sted." },
  ];

  const navSecondaryBtnStyle = {
    ...btn(false, { size: 'sm', radius: 'md', fontWeight: 600 }),
    borderColor: "transparent",
    background: "transparent",
    boxShadow: "none",
    textDecoration: "none",
  };
  const navPrimaryBtnStyle = {
    ...btn(true, { size: 'sm', radius: 'md' }),
  };
  const heroPrimaryBtnStyle = {
    ...btn(true, { size: 'lg', radius: 'lg' }),
    background: theme.onAccent,
    borderColor: "rgba(255,255,255,0.92)",
    color: theme.accent,
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  };
  const heroSecondaryBtnStyle = {
    ...btn(false, { size: 'lg', radius: 'lg', fontWeight: 600 }),
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.1)",
    color: theme.onAccent,
    backdropFilter: "blur(4px)",
    boxShadow: "none",
  };
  const mobileMenuActionStyle = {
    ...btn(false, { size: 'md', radius: 'md', fontWeight: 600 }),
    width: "100%",
    justifyContent: "flex-start",
    background: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
    padding: "13px 12px",
    fontSize: "15px",
    textDecoration: "none",
    color: theme.text,
  };
  const ctaPrimaryBtnStyle = {
    ...btn(true, { size: 'lg', radius: 'lg' }),
    background: theme.onAccent,
    borderColor: "rgba(255,255,255,0.92)",
    color: theme.accent,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  };
  const landingSectionStyle = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)",
  };
  const landingSectionIntroStyle = {
    textAlign: "center",
    marginBottom: "clamp(32px,7vw,48px)",
  };
  const landingSectionKickerStyle = {
    fontSize: "12px",
    fontWeight: 700,
    color: theme.accent,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: "10px",
  };
  const landingSectionHeadingStyle = {
    ...heading("clamp(26px,5.5vw,36px)"),
    letterSpacing: "-0.03em",
  };
  const landingFeatureCardStyle = {
    background: theme.surface,
    borderRadius: "14px",
    padding: "32px 24px",
    boxShadow: theme.shadow,
    border: "1px solid " + theme.border,
  };
  const landingFeatureTitleStyle = {
    fontSize: "18px",
    fontWeight: 700,
    marginBottom: "10px",
    letterSpacing: "-0.02em",
    color: theme.text,
  };
  const landingFeatureDescStyle = {
    fontSize: "14px",
    color: theme.textMid,
    lineHeight: 1.65,
  };
  const landingInfoCardStyle = {
    background: theme.surface,
    borderRadius: "14px",
    border: "1px solid " + theme.border,
    boxShadow: theme.shadow,
    padding: "clamp(20px,4vw,28px)",
  };

  return (
    <div
      className="pm-landing"
      ref={revealRef}
      style={{
        paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
        '--pm-landing-nav-h': navHeight > 0 ? `${navHeight}px` : undefined,
      }}
    >
      {/* Nav */}
      <nav ref={navRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: theme.surface, backdropFilter: "blur(12px)", borderBottom: "1px solid " + theme.border }}>
        <div className="pm-landing-nav" style={{ paddingTop: "max(clamp(12px,2.5vw,16px), env(safe-area-inset-top))", paddingBottom: "clamp(12px,2.5vw,16px)", paddingLeft: "clamp(16px,4vw,24px)", paddingRight: "clamp(16px,4vw,24px)", maxWidth: "1100px", margin: "0 auto" }}>
          <div className="pm-landing-nav-brand">
            <button type="button" onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }} aria-label="PadelMakker forsiden">
              <img src="/logo-brand.png" alt="PadelMakker logo" style={{ height: "clamp(40px,5vw,50px)", width: "auto", objectFit: "contain", display: "block" }} />
            </button>
            <button
              type="button"
              className="pm-landing-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? "Luk menu" : "Åbn menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
          <div className="pm-landing-nav-actions">
            <Link
              to="/events"
              className="pm-landing-nav-secondary"
              style={navSecondaryBtnStyle}
            >
              <CalendarDays size={16} aria-hidden />
              Events
            </Link>
            <Link
              to="/hjaelp"
              className="pm-landing-nav-secondary"
              style={navSecondaryBtnStyle}
            >
              <LifeBuoy size={16} aria-hidden />
              Hjælp
            </Link>
            <Link
              to="/app"
              className="pm-landing-nav-secondary"
              style={navSecondaryBtnStyle}
            >
              <Smartphone size={16} aria-hidden />
              App
            </Link>
            <button
              type="button"
              className="pm-landing-theme-btn"
              onClick={toggleTheme}
              aria-pressed={dark}
              title={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
              style={{
                ...navSecondaryBtnStyle,
                padding: "10px 12px",
              }}
            >
              {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              <span>{dark ? "Lys" : "Mørk"}</span>
            </button>
            <button onClick={() => navigate("/login")} style={navSecondaryBtnStyle}>Log ind</button>
            <button onClick={() => navigate("/opret")} style={navPrimaryBtnStyle}>Opret gratis profil</button>
          </div>
        </div>
      </nav>

      {/* Mobilmenu dropdown */}
      {menuOpen && (
        <>
          {/* Backdrop — klik udenfor lukker menuen */}
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 47 }} aria-hidden />
          <div className="pm-landing-mobile-menu">
            <Link to="/events" onClick={() => setMenuOpen(false)} style={mobileMenuActionStyle}>
              <CalendarDays size={18} color={theme.accent} /> Events
            </Link>
            <Link to="/hjaelp" onClick={() => setMenuOpen(false)} style={mobileMenuActionStyle}>
              <LifeBuoy size={18} color={theme.accent} /> Hjælp
            </Link>
            <Link to="/om" onClick={() => setMenuOpen(false)} style={mobileMenuActionStyle}>
              <Info size={18} color={theme.accent} /> Om PadelMakker
            </Link>
            <Link to="/faq" onClick={() => setMenuOpen(false)} style={mobileMenuActionStyle}>
              <CircleHelp size={18} color={theme.accent} /> FAQ
            </Link>
            <Link to="/app" onClick={() => setMenuOpen(false)} style={mobileMenuActionStyle}>
              <Smartphone size={18} color={theme.accent} /> App
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setMenuOpen(false);
              }}
              style={{
                ...mobileMenuActionStyle,
                gap: "12px",
                fontFamily: "inherit",
              }}
            >
              {dark ? <Sun size={18} color={theme.accent} /> : <Moon size={18} color={theme.accent} />}
              {dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
            </button>
          </div>
        </>
      )}

      {/* Hero */}
      <section
        className="pm-hero-gradient pm-landing-hero"
        style={{
          display: "flex",
          flexDirection: "column",
          paddingLeft: 0,
          paddingRight: 0,
          paddingBottom: 0,
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            paddingLeft: "clamp(16px,4vw,24px)",
            paddingRight: "clamp(16px,4vw,24px)",
            paddingBottom: "clamp(28px,6vw,44px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="pm-landing-hero-grid">
            <div className="pm-landing-hero-copy">
            <h1 className="pm-reveal pm-delay-1" style={{ fontFamily: font, fontSize: "clamp(40px,8vw,76px)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff", marginBottom: "24px" }}>
              Find makker<br />på dit niveau.<br /><span style={{ color: "#93C5FD" }}>Spil mere padel.</span>
            </h1>
            <p className="pm-reveal pm-delay-2" style={{ fontSize: "clamp(16px,3.8vw,19px)", color: "rgba(255,255,255,0.80)", maxWidth: "480px", margin: "0 auto clamp(36px,7vw,48px)", lineHeight: 1.65 }}>
              Find padelspillere på dit niveau, opret kampe og se ledige baner i Danmark. PadelMakker gør det nemmere at komme fra lyst til kamp.
            </p>
            <div className="pm-reveal pm-delay-3" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/opret")} style={heroPrimaryBtnStyle} aria-label="Opret gratis profil på PadelMakker">
                Opret gratis profil <ArrowRight size={17} />
              </button>
              <button onClick={() => navigate("/login")} style={heroSecondaryBtnStyle}>
                Log ind
              </button>
            </div>
            </div>
            <AnimatedAppMockup className="pm-landing-hero-mockup" />
          </div>
        </div>
        <div ref={heroRef} className="pm-hero-fade-tail" aria-hidden />
      </section>

      {/* Stats banner */}
      <section style={{ background: theme.surface, padding: "clamp(32px,6vw,48px) clamp(16px,4vw,24px)", borderBottom: "1px solid " + theme.border }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: "20px", textAlign: "center" }}>
          {[{ n: "200+", l: "Aktive spillere" }, { n: "10+", l: "Centre med bane-oversigt" }, { n: "50+", l: "Kampe ugentligt" }, { n: "4.7", l: "Gennemsnitlig rating" }].map((s, i) => (
            <div key={i} className={"pm-reveal pm-delay-" + (i+1)}>
              <div className="pm-stat-number" style={{ fontFamily: font, fontSize: "clamp(32px,7vw,44px)", fontWeight: 800, color: theme.accent, letterSpacing: "-0.04em" }}>{s.n}</div>
              <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "4px", fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pm-landing-mobile-mockup-section" style={{ background: theme.surface }}>
        <AnimatedAppMockup className="pm-landing-mobile-mockup pm-reveal-scale" />
      </section>

      <LandingTourVideo />

      {/* How it works */}
      <section style={landingSectionStyle}>
        <div className="pm-reveal" style={landingSectionIntroStyle}>
          <p style={landingSectionKickerStyle}>Sådan virker det</p>
          <h2 style={landingSectionHeadingStyle}>Fra profil til bane på minutter</h2>
          <p style={{ fontSize: "15px", color: theme.textMid, lineHeight: 1.7, maxWidth: "620px", margin: "14px auto 0" }}>
            Opret profil, find makker, book bane og følg din ELO — fire enkle skridt fra idéen om en kamp til en mere aktiv padel-hverdag.
          </p>
        </div>
        <div className="pm-landing-step-flow pm-reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,230px),1fr))", gap: "16px" }}>
          {steps.map((s, i) => (
            <div key={s.step} className={"pm-feature-card pm-reveal pm-delay-" + (i+1)} style={{ ...landingFeatureCardStyle, position: "relative" }}>
              <div style={{ fontSize: "48px", fontWeight: 900, color: theme.accent + "12", position: "absolute", top: "16px", right: "20px", letterSpacing: "-0.04em", fontFamily: font }}>{s.step}</div>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, " + theme.accent + ", #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                {s.icon}
              </div>
              <div style={{ ...landingFeatureTitleStyle, fontSize: "17px", marginBottom: "8px", letterSpacing: "-0.01em" }}>{s.title}</div>
              <div style={{ ...landingFeatureDescStyle, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <LandingEloExplainer />

      {/* Features */}
      <section style={{ background: theme.bg, padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="pm-reveal" style={landingSectionIntroStyle}>
            <p style={landingSectionKickerStyle}>Funktioner</p>
            <h2 style={landingSectionHeadingStyle}>Alt hvad du behøver</h2>
          </div>
          <div className="pm-landing-features-grid">
            {features.map((f, i) => (
              <div key={f.title} className={"pm-feature-card pm-reveal pm-delay-" + (i + 1)} style={landingFeatureCardStyle}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                  {f.icon}
                </div>
                <div style={landingFeatureTitleStyle}>{f.title}</div>
                <div style={landingFeatureDescStyle}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pm-reveal-scale" style={landingSectionStyle}>
        <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: "20px", padding: "clamp(40px,8vw,64px) clamp(24px,5vw,48px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: font, fontSize: "clamp(26px,5.5vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: "16px", lineHeight: 1.1 }}>
              Klar til at spille?
            </h2>
            <p style={{ fontSize: "clamp(15px,3.5vw,17px)", color: "rgba(255,255,255,0.75)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
              Opret din gratis profil, find spillere på dit niveau og gør det lettere at få næste kamp i kalenderen.
            </p>
            <button onClick={() => navigate("/opret")} style={ctaPrimaryBtnStyle} aria-label="Opret gratis profil og kom i gang">
              Kom i gang — det er gratis <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 clamp(16px,4vw,24px) clamp(32px,6vw,48px)" }}>
        <div className="pm-reveal" style={landingInfoCardStyle}>
          <p style={{ ...landingSectionKickerStyle, margin: "0 0 10px" }}>Centre på platformen</p>
          <h2 style={{ ...heading("clamp(20px,4vw,24px)"), margin: "0 0 14px", letterSpacing: "-0.02em" }}>Baner-overblik i appen</h2>
          <p style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.6, margin: "0 0 16px" }}>
            Se ledige tider og spring videre til booking hos: Skansen Padel, Padel Lounge Aalborg, Match Padel og PadelPadel Aalborg (AL Bank Arena).
          </p>
          <Link to="/om" style={{ fontSize: "14px", fontWeight: 600, color: theme.accent, textDecoration: "none" }}>
            Læs mere om PadelMakker →
          </Link>
        </div>
      </section>

      <footer className="pm-landing-footer" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(24px,6vw,36px) clamp(16px,4vw,24px)", fontSize: "13px", color: theme.textLight, flexDirection: "column", alignItems: "stretch", gap: "20px" }}>
        <div className="pm-landing-footer-topline">
          <span style={{ fontWeight: 500 }}>© 2026 PadelMakker &nbsp;·&nbsp; CVR-nr. 46403193</span>
        </div>
        <div className="pm-landing-footer-links">
            <p className="pm-landing-footer-links-title">Kontakt</p>
            <a href="mailto:kontakt@padelmakker.dk" className="pm-landing-footer-primary-link">
              <Mail size={14} aria-hidden />
              kontakt@padelmakker.dk
            </a>
            <Link to="/hjaelp" className="pm-landing-footer-primary-link">
              <LifeBuoy size={14} aria-hidden />
              Hjælp og kontakt
            </Link>
            <Link to="/app" className="pm-landing-footer-primary-link">
              <Smartphone size={14} aria-hidden />
              Installér app
            </Link>
            <p className="pm-landing-footer-links-title pm-landing-footer-links-title-secondary">Udforsk</p>
            <div className="pm-landing-footer-link-list-secondary">
            <Link to="/om" className="pm-landing-footer-secondary-link">
              Om PadelMakker
            </Link>
            <Link to="/faq" className="pm-landing-footer-secondary-link">
              FAQ
            </Link>
            <Link to="/events" className="pm-landing-footer-secondary-link">
              Events
            </Link>
            <Link to="/elo" className="pm-landing-footer-secondary-link">
              ELO
            </Link>
            </div>
        </div>
        <div className="pm-landing-footer-legal">
          <Link to="/privatlivspolitik">Privatlivspolitik</Link>
          <Link to="/handelsbetingelser">Handelsbetingelser</Link>
          <Link to="/cookies">Cookies</Link>
        </div>
      </footer>
    </div>
  );
}


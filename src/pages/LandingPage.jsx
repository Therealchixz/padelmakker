import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { displayFont, theme, btn, heading } from '../lib/platformTheme';
import { useScrollReveal } from '../lib/platformUtils';
import { ArrowRight, UserPlus, CalendarDays, LifeBuoy, Smartphone, Menu, X, Sun, Moon, Mail, Info, CircleHelp, Share2, LogIn } from 'lucide-react';
import { useDarkMode } from '../lib/useDarkMode';
import { fetchLandingPublicStats, buildLandingStatsItems } from '../lib/landingPublicStats';
import { fetchGrowthCampaignPublic, formatCampaignSpotsLabel } from '../lib/growthCampaign';
import { shareInviteFriendToApp, shareResultToastMessage } from '../lib/shareUtils';
import { LEGAL_INFO } from '../lib/legalInfo';
import { useAuth } from '../lib/AuthContext';

const AnimatedAppMockupLazy = lazy(() =>
  import('../components/AnimatedAppMockup').then((m) => ({ default: m.AnimatedAppMockup }))
);
const LandingEloExplainerLazy = lazy(() =>
  import('../components/LandingEloExplainer').then((m) => ({ default: m.LandingEloExplainer }))
);
const LandingTourVideoLazy = lazy(() =>
  import('../components/LandingTourVideo').then((m) => ({ default: m.LandingTourVideo }))
);

/** Sørg for at en tekst fra databasen slutter med punktum, før næste sætning sættes på. */
function withFullStop(text) {
  const t = String(text || '').trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function LandingPage() {
  const revealRef = useScrollReveal();
  const heroRef = useRef(null);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const { session } = useAuth();
  const goDashboard = () => navigate('/dashboard/hjem');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [navHeight, setNavHeight] = useState(0);
  const [showDeferredSections, setShowDeferredSections] = useState(false);
  const [publicStats, setPublicStats] = useState(null);
  const [campaignStats, setCampaignStats] = useState(null);
  const [inviteNote, setInviteNote] = useState('');
  const toggleTheme = () => setDark((isDark) => !isDark);

  useEffect(() => {
    let cancelled = false;
    void fetchLandingPublicStats().then((stats) => {
      if (!cancelled) setPublicStats(stats);
    });
    void fetchGrowthCampaignPublic().then((stats) => {
      if (!cancelled) setCampaignStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInviteFriend = async () => {
    setInviteNote('');
    const result = await shareInviteFriendToApp();
    const msg = shareResultToastMessage(result);
    if (msg) setInviteNote(msg);
  };

  const statsBannerItems = buildLandingStatsItems(publicStats);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const revealDeferredSections = () => {
      if (!cancelled) setShowDeferredSections(true);
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(revealDeferredSections, { timeout: 1600 });
      return () => {
        cancelled = true;
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      };
    }

    const timerId = window.setTimeout(revealDeferredSections, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  const steps = [
    { title: "Opret profil", desc: "Vælg niveau, region, spillestil og hvornår du kan spille. Vi bekræfter telefon og e-mail, så der ikke er falske profiler." },
    { title: "Find makker", desc: "Se spillere nær dig på dit niveau, og invitér dem til en kamp uden lange Facebook-tråde." },
    { title: "Find kamp og bane", desc: "Opret eller tilmeld dig 2v2, Liga eller Americano. Se ledige tider hos 150+ centre via Halbooking, MATCHi, Bookli og Playtomic." },
    { title: "Følg din rating", desc: "Bekræft resultatet sammen med modstanderne, og se din ELO på ranglisten. Så bliver næste kamp mere jævnbyrdig." },
  ];

  const landingCtaBlue = "var(--pm-landing-cta-blue)";
  const navSecondaryBtnStyle = {
    ...btn(false, { size: 'sm', radius: 'md', fontWeight: 600 }),
    borderColor: "transparent",
    background: "transparent",
    boxShadow: "none",
    textDecoration: "none",
  };
  const navPrimaryBtnStyle = {
    ...btn(true, { size: 'sm', radius: 'md' }),
    background: landingCtaBlue,
    borderColor: landingCtaBlue,
    color: theme.onAccent,
  };
  const heroPrimaryBtnStyle = {
    ...btn(true, { size: 'lg', radius: 'lg' }),
    background: theme.onAccent,
    borderColor: "rgba(255,255,255,0.92)",
    color: landingCtaBlue,
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
    color: landingCtaBlue,
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
  const landingSectionHeadingStyle = {
    ...heading("clamp(26px,5.5vw,36px)"),
    letterSpacing: "-0.03em",
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
      className="pm-landing pm-brand"
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
              <picture>
                <source srcSet={dark ? "/logo-brand-dark-nav.webp" : "/logo-brand-nav.webp"} type="image/webp" />
                <img
                  src={dark ? "/logo-brand-dark.png" : "/logo-brand.png"}
                  width={320}
                  height={120}
                  alt="PadelMakker logo"
                  style={{ height: "clamp(40px,5vw,50px)", width: "auto", objectFit: "contain", display: "block" }}
                />
              </picture>
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
            {session ? (
              <button type="button" onClick={goDashboard} style={navPrimaryBtnStyle}>
                Gå til dashboard
              </button>
            ) : (
              <>
                <button type="button" onClick={() => navigate("/login")} style={navSecondaryBtnStyle}>Log ind</button>
                <button type="button" onClick={() => navigate("/opret")} style={navPrimaryBtnStyle}>Opret gratis profil</button>
              </>
            )}
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
            {session ? (
              <button
                type="button"
                onClick={() => {
                  goDashboard();
                  setMenuOpen(false);
                }}
                style={{ ...mobileMenuActionStyle, fontFamily: "inherit", fontWeight: 700, color: theme.accent }}
              >
                <ArrowRight size={18} color={theme.accent} /> Gå til dashboard
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/login');
                  }}
                  style={{ ...mobileMenuActionStyle, fontFamily: 'inherit', fontWeight: 700 }}
                >
                  <LogIn size={18} color={theme.accent} /> Log ind
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/opret');
                  }}
                  style={{ ...mobileMenuActionStyle, fontFamily: 'inherit', fontWeight: 700, color: theme.accent }}
                >
                  <UserPlus size={18} color={theme.accent} /> Opret gratis profil
                </button>
              </>
            )}
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
            <h1 className="pm-reveal pm-visible pm-delay-1 pm-landing-hero-title">
              Find makker<br />på dit niveau.<br /><span className="pm-landing-hero-accent">Spil mere padel.</span>
            </h1>
            <p className="pm-reveal pm-visible pm-delay-2 pm-landing-hero-subtitle" style={{ fontSize: "clamp(16px,3.8vw,19px)", maxWidth: "480px", margin: "0 auto clamp(36px,7vw,48px)", lineHeight: 1.65 }}>
              Opret en gratis profil, se hvem der spiller på dit niveau i nærheden, og find en ledig bane hos 150+ centre.
            </p>
            <div className="pm-reveal pm-visible pm-delay-3" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              {session ? (
                <button type="button" onClick={goDashboard} style={heroPrimaryBtnStyle} aria-label="Gå til dashboard">
                  Gå til dashboard <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => navigate("/opret")} style={heroPrimaryBtnStyle} aria-label="Opret gratis profil på PadelMakker">
                    Opret gratis profil <ArrowRight size={17} />
                  </button>
                  <button type="button" onClick={() => navigate("/login")} style={heroSecondaryBtnStyle}>
                    Log ind
                  </button>
                </>
              )}
            </div>
            </div>
            {showDeferredSections ? (
              <Suspense fallback={<div className="pm-landing-hero-mockup" aria-hidden="true" />}>
                <AnimatedAppMockupLazy className="pm-landing-hero-mockup" />
              </Suspense>
            ) : (
              <div className="pm-landing-hero-mockup" aria-hidden="true" />
            )}
          </div>
        </div>
        <div ref={heroRef} className="pm-hero-fade-tail" aria-hidden />
      </section>

      {/* Stats banner */}
      <section style={{ background: theme.surface, padding: "clamp(32px,6vw,48px) clamp(16px,4vw,24px)", borderBottom: "1px solid " + theme.border }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: "20px", textAlign: "center" }}>
          {statsBannerItems.map((s, i) => (
            <div key={i} className={"pm-reveal pm-delay-" + (i+1)}>
              <div className="pm-stat-number" style={{ fontFamily: displayFont, fontSize: "clamp(32px,7vw,44px)", fontWeight: 800, color: theme.accent, letterSpacing: "-0.04em" }}>{s.n}</div>
              <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "4px", fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {campaignStats?.found && campaignStats.draw_completed ? (
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 clamp(16px,4vw,24px) clamp(24px,5vw,32px)' }}>
          <div className="pm-reveal pm-visible" style={landingInfoCardStyle}>
            <h2 style={{ ...heading('clamp(20px,4vw,26px)'), margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              Lodtrækningen blandt de første 200 er gennemført
            </h2>
            <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.65, margin: 0 }}>
              Lodtrækningen er afsluttet. Vinderen er kontaktet direkte.
            </p>
          </div>
        </section>
      ) : campaignStats?.found && campaignStats.is_open ? (
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 clamp(16px,4vw,24px) clamp(24px,5vw,32px)' }}>
          <div
            className="pm-reveal pm-visible"
            style={{
              ...landingInfoCardStyle,
              borderColor: theme.accent + '44',
              background: `linear-gradient(135deg, ${theme.accentBg}, ${theme.surface})`,
            }}
          >
            <h2 style={{ ...heading('clamp(20px,4vw,26px)'), margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              Vær blandt de første 200, og vær med i lodtrækningen
            </h2>
            <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.65, margin: '0 0 14px' }}>
              {withFullStop(campaignStats.prize_description || 'Padel-præmie til de første 200 med fuld profil.')}
              {' '}Eksisterende brugere tæller med. Pladserne går til dem, der først opfylder kravene.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px' }}>
              <div style={{ fontSize: 'clamp(28px,6vw,36px)', fontWeight: 800, color: theme.accent, letterSpacing: '-0.03em', fontFamily: displayFont }}>
                {formatCampaignSpotsLabel(campaignStats)}
              </div>
              <span style={{ fontSize: '13px', color: theme.textMid, fontWeight: 600 }}>pladser taget</span>
              <Link
                to="/kampagne/forste-200"
                style={{ fontSize: '14px', fontWeight: 600, color: theme.accent, textDecoration: 'none', marginLeft: 'auto' }}
              >
                Læs regler →
              </Link>
              {!session ? (
                <button type="button" onClick={() => navigate('/opret')} style={{ ...btn(true), padding: '10px 16px', fontSize: '13px' }}>
                  Opret profil og deltag
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pm-landing-mobile-mockup-section" style={{ background: theme.surface }}>
        {showDeferredSections ? (
          <Suspense fallback={<div className="pm-landing-mobile-mockup" aria-hidden="true" />}>
            <AnimatedAppMockupLazy className="pm-landing-mobile-mockup pm-reveal-scale" />
          </Suspense>
        ) : (
          <div className="pm-landing-mobile-mockup" aria-hidden="true" />
        )}
      </section>

      {showDeferredSections && (
        <Suspense fallback={null}>
          <LandingTourVideoLazy />
        </Suspense>
      )}

      {/* How it works */}
      <section style={landingSectionStyle}>
        <div className="pm-reveal" style={landingSectionIntroStyle}>
          <h2 style={landingSectionHeadingStyle}>Fra profil til kamp på fire skridt</h2>
        </div>
        <ol className="pm-landing-step-flow pm-reveal">
          {steps.map((s, i) => (
            <li key={s.title} className={"pm-landing-step pm-reveal pm-delay-" + (i + 1)}>
              <span className="pm-landing-step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {showDeferredSections && (
        <Suspense fallback={null}>
          <LandingEloExplainerLazy />
        </Suspense>
      )}

      {/* CTA */}
      <section className="pm-reveal-scale" style={landingSectionStyle}>
        <div className="pm-landing-cta-banner">
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2>{session ? 'Klar til næste kamp?' : 'Klar til at spille?'}</h2>
            <p style={{ fontSize: "clamp(15px,3.5vw,17px)", color: "var(--pm-hero-subtitle)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
              {session
                ? 'Du er logget ind. Hop tilbage i dashboard og find kampe, liga, makkere og baner.'
                : 'Opret din gratis profil, find spillere på dit niveau og gør det lettere at få næste kamp i kalenderen.'}
            </p>
            {session ? (
              <button type="button" onClick={goDashboard} style={ctaPrimaryBtnStyle} aria-label="Gå til dashboard">
                Gå til dashboard <ArrowRight size={17} />
              </button>
            ) : (
              <button type="button" onClick={() => navigate("/opret")} style={ctaPrimaryBtnStyle} aria-label="Opret gratis profil og kom i gang">
                Opret gratis profil <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="pm-landing-footer" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(24px,6vw,36px) clamp(16px,4vw,24px)", fontSize: "13px", color: theme.textLight, flexDirection: "column", alignItems: "stretch", gap: "20px" }}>
        <div className="pm-landing-footer-topline">
          <span style={{ fontWeight: 500 }}>© 2026 PadelMakker &nbsp;·&nbsp; CVR-nr. {LEGAL_INFO.cvr}</span>
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
            <button
              type="button"
              className="pm-landing-footer-primary-link"
              onClick={() => void handleInviteFriend()}
              style={{ fontFamily: "inherit", cursor: "pointer" }}
            >
              <Share2 size={14} aria-hidden />
              Inviter en ven
            </button>
            {inviteNote ? (
              <p style={{ fontSize: "12px", color: theme.accent, margin: 0, fontWeight: 600 }} role="status">
                {inviteNote}
              </p>
            ) : null}
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


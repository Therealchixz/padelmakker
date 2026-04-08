import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { useScrollReveal } from '../lib/platformUtils';
import { UserPlus, Users, MapPin, TrendingUp, Trophy, Swords, MessageCircle, Medal, MapPinned, LineChart, ArrowRight } from 'lucide-react';

export function LandingPage() {
  const revealRef = useScrollReveal();
  const heroRef = useRef(null);
  const navigate = useNavigate();

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

  const steps = [
    { step: "01", icon: <UserPlus  size={24} color="#fff" />, title: "Opret profil", desc: "Angiv dit niveau, spillestil og region — det tager under et minut." },
    { step: "02", icon: <Users     size={24} color="#fff" />, title: "Find makker",  desc: "Se spillere nær dig på dit niveau og invitér dem til en kamp." },
    { step: "03", icon: <MapPin    size={24} color="#fff" />, title: "Book bane",    desc: "Find ledige baner med priser og tider — book direkte i appen." },
    { step: "04", icon: <TrendingUp size={24} color="#fff" />, title: "Rank op",     desc: "Spil kampe, optjen ELO-point og klatr op ad ranglisten." },
  ];

  const features = [
    { icon: <Trophy size={22} color={theme.accent} />, title: "ELO-ranking", desc: "Avanceret ranking-system der matcher dig med jævnbyrdige spillere." },
    { icon: <Swords size={22} color={theme.accent} />, title: "Holdkampe", desc: "Opret 2v2 kampe, vælg hold og registrér resultater med tiebreak-validering." },
    { icon: <Medal size={22} color={theme.accent} />, title: "Americano", desc: "Opret turneringer med automatisk rundeplan, fair rotation og stilling — et format for sig, uden at det påvirker din ELO." },
    { icon: <MapPinned size={22} color={theme.accent} />, title: "Ledige baner", desc: "Se live ledige tider hos udvalgte centre og hop direkte videre til booking, når du har fundet et tidspunkt." },
    { icon: <MessageCircle size={22} color={theme.accent} />, title: "Fællesskab", desc: "Bliv en del af Danmarks voksende padel-community med hundredvis af aktive spillere." },
    { icon: <LineChart size={22} color={theme.accent} />, title: "Profil & udvikling", desc: "Følg din ELO over tid, se streaks og kamphistorik — så du kan se, hvordan dit niveau udvikler sig." },
  ];

  return (
    <div className="pm-landing" ref={revealRef}>
      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid " + theme.border }}>
        <div className="pm-landing-nav" style={{ padding: "clamp(12px, 2.5vw, 16px) clamp(16px, 4vw, 24px)", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ ...heading("clamp(17px,4.5vw,20px)"), color: theme.accent, display: "flex", alignItems: "center", gap: "8px" }}>🎾 PadelMakker</div>
          <div className="pm-landing-nav-actions">
            <button onClick={() => navigate("/login")} style={{ ...btn(false), borderColor: "transparent", background: "transparent" }}>Log ind</button>
            <button onClick={() => navigate("/opret")} style={{ ...btn(true), borderRadius: "8px" }}>Kom i gang</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="pm-hero-gradient"
        style={{
          display: "flex",
          flexDirection: "column",
          paddingTop: "clamp(100px,18vw,140px)",
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
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div className="pm-reveal" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "12px", fontWeight: 600, padding: "6px 16px", borderRadius: "20px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.25)", letterSpacing: "0.03em", backdropFilter: "blur(4px)" }}>
              🇩🇰 Danmarks padel-platform
            </div>
            <h1 className="pm-reveal pm-delay-1" style={{ fontFamily: font, fontSize: "clamp(40px,8vw,76px)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff", marginBottom: "24px" }}>
              Find makker.<br />Book bane.<br /><span style={{ color: "#93C5FD" }}>Spil padel.</span>
            </h1>
            <p className="pm-reveal pm-delay-2" style={{ fontSize: "clamp(16px,3.8vw,19px)", color: "rgba(255,255,255,0.80)", maxWidth: "480px", margin: "0 auto clamp(36px,7vw,48px)", lineHeight: 1.65 }}>
              Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau — gratis.
            </p>
            <div className="pm-reveal pm-delay-3" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/opret")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 700, padding: "14px 32px", borderRadius: "10px", border: "none", background: "#fff", color: theme.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                Opret gratis profil <ArrowRight size={17} />
              </button>
              <button onClick={() => navigate("/login")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 600, padding: "14px 28px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", backdropFilter: "blur(4px)", letterSpacing: "-0.01em" }}>
                Log ind
              </button>
            </div>
          </div>
        </div>
        <div ref={heroRef} className="pm-hero-fade-tail" aria-hidden />
      </section>

      {/* Stats banner */}
      <section style={{ background: theme.surface, padding: "clamp(32px,6vw,48px) clamp(16px,4vw,24px)", borderBottom: "1px solid " + theme.border }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: "20px", textAlign: "center" }}>
          {[{ n: "200+", l: "Aktive spillere" }, { n: "3", l: "Baner i Nordjylland" }, { n: "50+", l: "Kampe ugentligt" }, { n: "4.7", l: "Gennemsnitlig rating" }].map((s, i) => (
            <div key={i} className={"pm-reveal pm-delay-" + (i+1)}>
              <div className="pm-stat-number" style={{ fontFamily: font, fontSize: "clamp(32px,7vw,44px)", fontWeight: 800, color: theme.accent, letterSpacing: "-0.04em" }}>{s.n}</div>
              <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "4px", fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div className="pm-reveal" style={{ textAlign: "center", marginBottom: "clamp(32px,7vw,48px)" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: theme.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Sådan virker det</p>
          <h2 style={{ ...heading("clamp(26px,5.5vw,36px)"), letterSpacing: "-0.03em" }}>Fra profil til bane på minutter</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,230px),1fr))", gap: "16px" }}>
          {steps.map((s, i) => (
            <div key={s.step} className={"pm-feature-card pm-reveal pm-delay-" + (i+1)} style={{ background: theme.surface, borderRadius: "14px", padding: "32px 24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, position: "relative" }}>
              <div style={{ fontSize: "48px", fontWeight: 900, color: theme.accent + "12", position: "absolute", top: "16px", right: "20px", letterSpacing: "-0.04em", fontFamily: font }}>{s.step}</div>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, " + theme.accent + ", #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                {s.icon}
              </div>
              <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-0.01em", color: theme.text }}>{s.title}</div>
              <div style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: theme.bg, padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="pm-reveal" style={{ textAlign: "center", marginBottom: "clamp(32px,7vw,48px)" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: theme.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Funktioner</p>
            <h2 style={{ ...heading("clamp(26px,5.5vw,36px)"), letterSpacing: "-0.03em" }}>Alt hvad du behøver</h2>
          </div>
          <div className="pm-landing-features-grid">
            {features.map((f, i) => (
              <div key={f.title} className={"pm-feature-card pm-reveal pm-delay-" + (i + 1)} style={{ background: theme.surface, borderRadius: "14px", padding: "32px 24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", letterSpacing: "-0.02em", color: theme.text }}>{f.title}</div>
                <div style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pm-reveal-scale" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: "20px", padding: "clamp(40px,8vw,64px) clamp(24px,5vw,48px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: font, fontSize: "clamp(26px,5.5vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: "16px", lineHeight: 1.1 }}>
              Klar til at spille?
            </h2>
            <p style={{ fontSize: "clamp(15px,3.5vw,17px)", color: "rgba(255,255,255,0.75)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
              Opret din profil på under et minut og find din første makker i dag.
            </p>
            <button onClick={() => navigate("/opret")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 700, padding: "14px 36px", borderRadius: "10px", border: "none", background: "#fff", color: theme.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              Kom i gang — det er gratis <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <footer className="pm-landing-footer" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(24px,6vw,36px) clamp(16px,4vw,24px)", fontSize: "13px", color: theme.textLight }}>
        <span style={{ fontWeight: 500 }}>© 2026 PadelMakker</span>
        <span>kontakt@padelmakker.dk</span>
      </footer>
    </div>
  );
}

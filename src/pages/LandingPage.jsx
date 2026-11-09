import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, Mail, LifeBuoy, Smartphone, Share2 } from 'lucide-react';
import { fetchLandingPublicStats, buildLandingLiveStats, buildLandingTickerItems, buildLandingLiveLine, hasLandingLiveCount } from '../lib/landingPublicStats';
import { fetchGrowthCampaignPublic } from '../lib/growthCampaign';
import { shareInviteFriendToApp, shareResultToastMessage } from '../lib/shareUtils';
import { LEGAL_INFO } from '../lib/legalInfo';
import { useAuth } from '../lib/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatMatchDateDa, formatTimeSlotDa } from '../lib/matchDisplayUtils';
import { buildPublicTournamentPath } from '../lib/publicShareRoutes';
import { LANDING_STORY_STEPS } from '../components/landing/LandingStoryScreens';
import { setThemeColor, syncThemeColorWithTheme, THEME_COLOR_INK } from '../lib/themeColor';
import '../styles/landing.css';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Hent de naeste offentlige turneringer (uden deltagernavne). Tom liste ved fejl. */
async function fetchUpcomingEvents(limit = 3) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.rpc('public_upcoming_americano_events', { p_limit: limit });
    if (error) return [];
    return Array.isArray(data) ? data.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function HeroPhoto({ eager = false }) {
  return (
    <picture>
      <source media="(max-width: 540px)" srcSet="/hero-bg-mobile.avif" type="image/avif" />
      <source media="(max-width: 540px)" srcSet="/hero-bg-mobile.webp" type="image/webp" />
      <source srcSet="/hero-bg.avif" type="image/avif" />
      <source srcSet="/hero-bg.webp" type="image/webp" />
      <img
        src="/hero-bg.jpg"
        alt=""
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </picture>
  );
}


/** Teksten om praemien kommer fra databasen og mangler nogle gange punktum. */
function withFinalPeriod(text) {
  const t = String(text || '').trim();
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
}

export function LandingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const signedIn = Boolean(session);

  const [publicStats, setPublicStats] = useState(null);
  const [campaign, setCampaign] = useState(null);
  // Det rullende baand kan stoppes med et tryk (WCAG 2.2.2); det stopper ogsaa ved hover/fokus i CSS.
  const [tickerPaused, setTickerPaused] = useState(false);
  const [events, setEvents] = useState([]);
  const [inviteNote, setInviteNote] = useState('');
  const [storyStep, setStoryStep] = useState(0);

  const rootRef = useRef(null);
  const heroPhotoRef = useRef(null);
  const heroCopyRef = useRef(null);
  const storyRef = useRef(null);
  const storyBarRefs = useRef([]);
  const storyTrackRef = useRef(null);
  const storyScreenRefs = useRef([]);
  const revealRef = useRef(null);
  const revealImgRef = useRef(null);
  const revealTextRef = useRef(null);

  // Statusbjaelken paa telefonen skal vaere moerk som forsiden, og skifte tilbage naar man gaar videre.
  useEffect(() => {
    setThemeColor(THEME_COLOR_INK);
    return () => syncThemeColorWithTheme();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLandingPublicStats().then((s) => { if (!cancelled) setPublicStats(s); });
    void fetchGrowthCampaignPublic().then((c) => { if (!cancelled) setCampaign(c); });
    void fetchUpcomingEvents(3).then((rows) => { if (!cancelled) setEvents(rows); });
    return () => { cancelled = true; };
  }, []);

  // Scroll-effekterne: foto-parallax, den fastgjorte "Saadan virker det" og fotoet der aabner sig.
  useEffect(() => {
    const reduce = prefersReducedMotion();
    let raf = 0;
    let lastStep = -1;

    const apply = () => {
      raf = 0;
      const st = window.scrollY || 0;
      const vh = window.innerHeight || 800;

      if (!reduce) {
        if (heroPhotoRef.current) {
          heroPhotoRef.current.style.transform = `translate3d(0, ${st * 0.45}px, 0) scale(${1 + st * 0.00025})`;
        }
        if (heroCopyRef.current) {
          heroCopyRef.current.style.opacity = String(clamp01(1 - st / 420));
          heroCopyRef.current.style.transform = `translate3d(0, ${-st * 0.22}px, 0)`;
        }
      }

      const story = storyRef.current;
      if (story) {
        const rect = story.getBoundingClientRect();
        const range = Math.max(1, rect.height - vh);
        const p = clamp01(-rect.top / range);
        const n = LANDING_STORY_STEPS.length;
        const seg = p * n;
        // Hvert trin staar stille det meste af sit stykke (saa man kan laese det),
        // og glider saa videre til det naeste i den sidste del.
        const k = Math.min(n - 1, Math.floor(seg));
        const f = seg - k;
        const t = k >= n - 1 ? 0 : clamp01((f - 0.55) / 0.45);
        const x = k + t * t * (3 - 2 * t);
        storyBarRefs.current.forEach((el, i) => {
          if (el) el.style.transform = `scaleX(${clamp01(seg - i)})`;
        });
        if (storyTrackRef.current) {
          storyTrackRef.current.style.transform = `translate3d(${12 - x * 80}%, 0, 0)`;
        }
        storyScreenRefs.current.forEach((el, i) => {
          if (!el) return;
          const d = Math.min(1, Math.abs(i - x));
          el.style.transform = `scale(${1 - d * 0.1})`;
          el.style.opacity = String(1 - d * 0.55);
        });
        const step = Math.round(x);
        if (step !== lastStep) {
          lastStep = step;
          setStoryStep(step);
        }
      }

      const rv = revealRef.current;
      if (rv && !reduce) {
        const rect = rv.getBoundingClientRect();
        const q = clamp01((vh - rect.top) / (vh * 0.85));
        // Lille indrykning foroven/forneden, saa der ikke staar et tomt felt over billedet.
        const insY = (1 - q) * 5;
        const insX = (1 - q) * 10;
        rv.style.clipPath = `inset(${insY}% ${insX}% ${insY}% ${insX}% round ${28 - q * 8}px)`;
        if (revealImgRef.current) revealImgRef.current.style.transform = `scale(${1.25 - q * 0.25})`;
        if (revealTextRef.current) revealTextRef.current.style.transform = `translate3d(${(1 - q) * -60}px, 0, 0)`;
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Sektioner der toner frem, naar man scroller ned til dem.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reveal = (el) => el.classList.add('is-in');
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      root.querySelectorAll('[data-lp-reveal]').forEach(reveal);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          reveal(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    root.querySelectorAll('[data-lp-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [events.length, campaign]);

  const handleInviteFriend = async () => {
    setInviteNote('');
    const result = await shareInviteFriendToApp();
    const msg = shareResultToastMessage(result);
    if (msg) setInviteNote(msg);
  };

  const goPrimary = () => navigate(signedIn ? '/dashboard/hjem' : '/opret');
  const primaryLabel = signedIn ? 'Gå til appen' : 'Opret gratis profil';

  const stats = buildLandingLiveStats(publicStats);
  const liveNow = hasLandingLiveCount(publicStats);
  const ticker = buildLandingTickerItems(publicStats);
  const liveLine = buildLandingLiveLine(publicStats);

  const campaignOpen = Boolean(campaign?.found && campaign.is_open);
  const campaignDone = Boolean(campaign?.found && campaign.draw_completed);
  const spotsTaken = Number(campaign?.spots_taken ?? 0);
  const spotsTotal = Number(campaign?.spots_total ?? 200) || 200;

  return (
    <div className="pm-lp" ref={rootRef}>
      {/* Toppen: foto af banen, overskrift og knap */}
      <header className="pm-lp-hero">
        <div className="pm-lp-hero-photo" ref={heroPhotoRef} aria-hidden="true">
          <div className="pm-lp-hero-zoom">
            <HeroPhoto eager />
          </div>
        </div>
        <div className="pm-lp-hero-shade" aria-hidden="true" />

        <nav className="pm-lp-nav" aria-label="Hovedmenu">
          <div className="pm-lp-inner">
            <Link to="/" aria-label="PadelMakker forsiden" className="pm-lp-nav-home">
              <picture>
                <source srcSet="/logo-brand-dark-nav.webp" type="image/webp" />
                <img
                  className="pm-lp-nav-logo"
                  src="/logo-brand-dark.png"
                  width={320}
                  height={120}
                  alt="PadelMakker logo"
                />
              </picture>
            </Link>
            <div className="pm-lp-nav-links">
              <Link className="pm-lp-nav-text" to="/events">Events</Link>
              <Link className="pm-lp-nav-text" to="/hjaelp">Hjælp</Link>
              {signedIn ? (
                <button type="button" className="pm-lp-pill" onClick={() => navigate('/dashboard/hjem')}>
                  Gå til appen
                </button>
              ) : (
                <>
                  <button type="button" className="pm-lp-pill" onClick={() => navigate('/login')}>
                    <LogIn size={16} aria-hidden />
                    Log ind
                  </button>
                  <button type="button" className="pm-lp-pill pm-lp-pill--solid pm-lp-nav-signup" onClick={() => navigate('/opret')}>
                    Opret profil
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>

        <div className="pm-lp-hero-copy" ref={heroCopyRef}>
          <div className="pm-lp-inner">
            <div className="pm-lp-hero-text">
              <h1 className="pm-lp-display pm-lp-h1">
                <span><span>Find din</span></span>
                <span><span>makker.</span></span>
                <span><span>Spil i aften.</span></span>
              </h1>
              <p className="pm-lp-sub">
                Spillere på dit niveau, åbne kampe og ledige baner hos 150+ centre. Ét sted, gratis.
              </p>
              <div className="pm-lp-hero-actions">
                <button type="button" className="pm-lp-cta" onClick={goPrimary}>
                  <span>{primaryLabel}</span>
                  <ArrowRight size={20} aria-hidden />
                </button>
              </div>
              <p className={'pm-lp-live' + (liveNow ? ' is-live' : '')}>
                {liveNow ? <span className="pm-lp-live-dot" aria-hidden="true" /> : null}
                {liveLine}
              </p>
            </div>
          </div>
        </div>

        <div
          className={'pm-lp-ticker' + (tickerPaused ? ' is-paused' : '')}
          role="button"
          tabIndex={0}
          aria-pressed={tickerPaused}
          aria-label={tickerPaused ? 'Start det rullende bånd' : 'Stop det rullende bånd'}
          onClick={() => setTickerPaused((p) => !p)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setTickerPaused((p) => !p);
            }
          }}
        >
          <div className="pm-lp-ticker-track">
            {ticker.map((t) => <span key={t}>{t}</span>)}
            {ticker.map((t) => <span key={`dup-${t}`} aria-hidden="true">{t}</span>)}
          </div>
        </div>
      </header>

      <main>
        {/* Tal: kun rigtige tal fra databasen over minimum; ellers vises baandet ikke */}
        {stats.length > 0 && (
          <section className="pm-lp-stats" aria-label="PadelMakker lige nu">
            {stats.map((s) => (
              <div key={s.l} className="pm-lp-stat">
                <div className="pm-lp-stat-n">{s.n}</div>
                <div className="pm-lp-stat-l">{s.l}</div>
              </div>
            ))}
          </section>
        )}

        {/* Saadan virker det: fastgjort; skaermene glider sidelaens i takt med scroll */}
        <section className="pm-lp-story" ref={storyRef} aria-labelledby="pm-lp-story-title">
          <div className="pm-lp-story-stick pm-lp-inner">
            <div className="pm-lp-story-head">
              <h2 id="pm-lp-story-title" className="pm-lp-display pm-lp-h2">Sådan virker det</h2>
              <span className="pm-lp-story-count pm-lp-mono" aria-hidden="true">
                Trin {storyStep + 1} af {LANDING_STORY_STEPS.length}
              </span>
            </div>
            <div className="pm-lp-story-bar" aria-hidden="true">
              {LANDING_STORY_STEPS.map(({ key }, i) => (
                <span key={key}><span ref={(el) => { storyBarRefs.current[i] = el; }} /></span>
              ))}
            </div>
            <div className="pm-lp-story-body">
              <div className="pm-lp-story-stage" aria-hidden="true">
                <div className="pm-lp-story-track" ref={storyTrackRef}>
                  {LANDING_STORY_STEPS.map(({ key, Screen }, i) => (
                    <div
                      key={key}
                      ref={(el) => { storyScreenRefs.current[i] = el; }}
                      className={'pm-lp-story-screen' + (i === storyStep ? ' is-active' : '')}
                    >
                      <Screen />
                    </div>
                  ))}
                </div>
              </div>
              <ol className="pm-lp-story-copy" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {LANDING_STORY_STEPS.map((s, i) => (
                  <li
                    key={s.key}
                    className={'pm-lp-story-step' + (i === storyStep ? ' is-active' : i < storyStep ? ' is-before' : '')}
                  >
                    <div className="pm-lp-story-step-screen" aria-hidden="true"><s.Screen /></div>
                    <h3 className="pm-lp-display pm-lp-h3">{s.title}</h3>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Fotoet der aabner sig */}
        <section className="pm-lp-reveal" ref={revealRef} aria-label="Lokale kampe, lokale baner">
          <div className="pm-lp-reveal-img" ref={revealImgRef} aria-hidden="true">
            <HeroPhoto />
          </div>
          <p className="pm-lp-display pm-lp-reveal-text" ref={revealTextRef}>
            Lokale kampe.
            <span>Lokale baner.</span>
          </p>
        </section>

        {/* Kommende turneringer (kun naar der er nogen) */}
        {events.length > 0 && (
          <section className="pm-lp-section pm-lp-inner" aria-labelledby="pm-lp-events-title">
            <div className="pm-lp-section-head" data-lp-reveal>
              <h2 id="pm-lp-events-title" className="pm-lp-display pm-lp-h2">Næste turneringer</h2>
              <Link className="pm-lp-link" to="/events">
                Se alle <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
            <ul className="pm-lp-events">
              {events.map((row) => {
                const filled = Number(row.participant_count) || 0;
                const cap = Number(row.player_slots) || 0;
                const free = Math.max(0, cap - filled);
                const court = row.court_name && String(row.court_name).trim() ? row.court_name : 'Bane ikke angivet';
                const spots = row.status === 'playing'
                  ? 'I gang'
                  : free > 0 ? `${free} ledig${free === 1 ? '' : 'e'}` : 'Fuld';
                return (
                  <li key={row.id} data-lp-reveal>
                    <Link className="pm-lp-event" to={buildPublicTournamentPath(row.id)}>
                      <span>
                        <span className="pm-lp-event-time">{formatTimeSlotDa(row.time_slot)}</span>
                        <span className="pm-lp-event-day pm-lp-mono">{formatMatchDateDa(row.tournament_date)}</span>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="pm-lp-event-name">{row.name}</span>
                        <span className="pm-lp-event-meta pm-lp-mono">{court} · {filled}/{cap} tilmeldt</span>
                      </span>
                      <span className="pm-lp-event-spots pm-lp-mono">{spots}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Afslutning: Foerste 200 naar kampagnen er aaben, ellers en almindelig opfordring */}
        <section className="pm-lp-close" data-lp-reveal aria-labelledby="pm-lp-close-title">
          <div className="pm-lp-close-inner">
            {campaignOpen && !signedIn ? (
              <>
                <h2 id="pm-lp-close-title" className="pm-lp-display">Vær med fra start.</h2>
                <p>
                  {spotsTaken} af {spotsTotal} pladser er taget blandt de første 200 med fuld profil.
                  {campaign.prize_description ? ` ${withFinalPeriod(campaign.prize_description)}` : ''}
                </p>
                <div
                  className="pm-lp-progress"
                  role="progressbar"
                  aria-label="Pladser taget"
                  aria-valuemin={0}
                  aria-valuemax={spotsTotal}
                  aria-valuenow={spotsTaken}
                >
                  <div style={{ width: `${Math.min(100, (spotsTaken / spotsTotal) * 100)}%` }} />
                </div>
                <button type="button" className="pm-lp-cta pm-lp-cta--ink" onClick={goPrimary}>
                  <span>Opret gratis profil</span>
                  <ArrowRight size={20} aria-hidden />
                </button>
                <Link className="pm-lp-close-rules" to="/kampagne/forste-200">Læs reglerne for Første 200</Link>
              </>
            ) : (
              <>
                <h2 id="pm-lp-close-title" className="pm-lp-display">
                  {signedIn ? 'Klar til næste kamp?' : 'Klar til at spille?'}
                </h2>
                <p>
                  {signedIn
                    ? 'Tryk Spil i appen, vælg hvornår og hvor, og se de kampe, der passer.'
                    : 'Opret din gratis profil og se, hvem der spiller på dit niveau i nærheden.'}
                  {campaignDone ? ' Lodtrækningen blandt de første 200 er gennemført, og vinderen er kontaktet.' : ''}
                </p>
                <button type="button" className="pm-lp-cta pm-lp-cta--ink" onClick={goPrimary}>
                  <span>{primaryLabel}</span>
                  <ArrowRight size={20} aria-hidden />
                </button>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="pm-lp-footer pm-lp-inner">
        <div className="pm-lp-footer-cols">
          <div>
            <h2>Kontakt</h2>
            <ul>
              <li><a href="mailto:kontakt@padelmakker.dk"><Mail size={15} aria-hidden /> kontakt@padelmakker.dk</a></li>
              <li><Link to="/hjaelp"><LifeBuoy size={15} aria-hidden /> Hjælp og kontakt</Link></li>
              <li><Link to="/app"><Smartphone size={15} aria-hidden /> Installér app</Link></li>
              <li>
                <button type="button" onClick={() => void handleInviteFriend()}>
                  <Share2 size={15} aria-hidden /> Inviter en ven
                </button>
                {inviteNote ? <p className="pm-lp-footer-note" role="status">{inviteNote}</p> : null}
              </li>
            </ul>
          </div>
          <div>
            <h2>Udforsk</h2>
            <ul>
              <li><Link to="/om">Om PadelMakker</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/events">Events</Link></li>
              <li><Link to="/elo">Sådan virker ELO</Link></li>
            </ul>
          </div>
        </div>
        <div className="pm-lp-footer-base">
          <span className="pm-lp-mono">© 2026 PadelMakker · CVR {LEGAL_INFO.cvr}</span>
          <nav className="pm-lp-footer-legal" aria-label="Juridisk">
            <Link to="/privatlivspolitik">Privatlivspolitik</Link>
            <Link to="/handelsbetingelser">Handelsbetingelser</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

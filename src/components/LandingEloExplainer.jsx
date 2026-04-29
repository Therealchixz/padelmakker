import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react';
import { formatEloDelta, landingEloExplainerSteps, landingEloScoreExample } from '../lib/landingEloExplainer';
import { font, heading } from '../lib/platformTheme';

const stepIcons = {
  before: ShieldCheck,
  match: CheckCircle2,
  after: TrendingUp,
};

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function LandingEloExplainer() {
  const cardRef = useRef(null);
  const [displayElo, setDisplayElo] = useState(landingEloScoreExample.oldElo);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof window === 'undefined') return undefined;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = Boolean(motionQuery?.matches);
    if (prefersReducedMotion) {
      setDisplayElo(landingEloScoreExample.newElo);
      return undefined;
    }

    let frameId = 0;
    let started = false;

    const runCounter = () => {
      const durationMs = 1150;
      const startAt = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - startAt) / durationMs);
        const eased = easeOutCubic(progress);
        const nextElo = Math.round(
          landingEloScoreExample.oldElo
          + (landingEloScoreExample.newElo - landingEloScoreExample.oldElo) * eased
        );
        setDisplayElo(nextElo);

        if (progress < 1) {
          frameId = requestAnimationFrame(tick);
        }
      };

      frameId = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') {
      runCounter();
      return () => {
        if (frameId) cancelAnimationFrame(frameId);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return;
        started = true;
        runCounter();
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section className="pm-landing-elo-section" aria-labelledby="landing-elo-heading">
      <div className="pm-landing-elo-inner">
        <div className="pm-landing-elo-copy pm-reveal-left">
          <p className="pm-landing-kicker">ELO-ranking</p>
          <h2 id="landing-elo-heading" style={{ ...heading('clamp(26px,5.5vw,38px)'), margin: 0 }}>
            Hver kamp gør din næste kamp bedre
          </h2>
          <p>
            PadelMakker bruger resultater til at gøre niveauet mere præcist, så nye makkere og åbne kampe
            føles mere fair fra start.
          </p>
        </div>

        <div ref={cardRef} className="pm-elo-explainer-card pm-reveal-right">
          <div className="pm-elo-explainer-card-head">
            <span>Live eksempel</span>
            <strong>{landingEloScoreExample.confirmation}</strong>
          </div>

          <div className="pm-elo-score-stage">
            <div className="pm-elo-player-card">
              <span>Før kampen</span>
              <strong>{landingEloScoreExample.playerName}</strong>
              <b>{landingEloScoreExample.oldElo} ELO</b>
            </div>

            <div className="pm-elo-result-pill">
              <span>{landingEloScoreExample.result}</span>
            </div>

            <div className="pm-elo-player-card pm-elo-player-card--after">
              <span>Efter kampen</span>
              <strong>{landingEloScoreExample.playerName}</strong>
              <b style={{ fontFamily: font }} aria-live="polite">{displayElo} ELO</b>
              <em>{formatEloDelta(landingEloScoreExample.delta)}</em>
            </div>
          </div>

          <div className="pm-elo-step-list">
            {landingEloExplainerSteps.map((step) => {
              const Icon = stepIcons[step.key] ?? CheckCircle2;
              return (
                <div className="pm-elo-step-item" key={step.key}>
                  <span className="pm-elo-step-icon">
                    <Icon size={16} strokeWidth={2.5} />
                  </span>
                  <span>
                    <small>{step.label}</small>
                    <strong>{step.title}</strong>
                    <em>{step.detail}</em>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

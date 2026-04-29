import { CalendarDays, MapPin, Swords, TrendingUp, Users } from 'lucide-react';
import { getLandingMockupAriaLabel, landingMockupBrand, landingMockupSteps } from '../lib/landingMockupSteps';

const stepIcons = {
  profile: Users,
  matches: Users,
  court: MapPin,
  match: Swords,
  elo: TrendingUp,
};

export function AnimatedAppMockup({ className = '' }) {
  return (
    <figure className={`pm-app-mockup ${className}`.trim()} role="img" aria-label={getLandingMockupAriaLabel()}>
      <div className="pm-app-mockup-glow" aria-hidden="true" />
      <div className="pm-app-mockup-phone" aria-hidden="true">
        <div className="pm-app-mockup-speaker" />
        <div className="pm-app-mockup-appbar">
          <span className="pm-app-mockup-brand-text">
            <strong>{landingMockupBrand.name}</strong>
            <small>{landingMockupBrand.tagline}</small>
          </span>
          <span className="pm-app-mockup-live">
            <span className="pm-app-mockup-live-dot" />
            Live
          </span>
        </div>

        <div className="pm-app-mockup-hero-card">
          <span className="pm-app-mockup-kicker">Din næste kamp</span>
          <strong>Find makker på dit niveau</strong>
          <small>Fra profil til bane på få minutter</small>
        </div>

        <div className="pm-app-mockup-mini-row">
          <span>
            <CalendarDays size={14} />
            I dag
          </span>
          <span>ELO 950-1100</span>
        </div>

        <div className="pm-app-mockup-card-stack">
          {landingMockupSteps.map((step, index) => {
            const Icon = stepIcons[step.key] ?? Users;
            return (
              <div
                className={`pm-app-mockup-step pm-app-mockup-step-${step.tone}`}
                key={step.key}
                style={{ '--pm-step-index': index }}
              >
                <span className="pm-app-mockup-step-icon">
                  <Icon size={17} strokeWidth={2.4} />
                </span>
                <span className="pm-app-mockup-step-copy">
                  <span className="pm-app-mockup-step-eyebrow">{step.eyebrow}</span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
                <span className="pm-app-mockup-step-metric">{step.metric}</span>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}

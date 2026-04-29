import { MapPin, TrendingUp, Users } from 'lucide-react';
import {
  getLandingMockupAriaLabel,
  landingMockupBrand,
  landingMockupCarouselScreens,
  landingMockupScreens,
} from '../lib/landingMockupSteps';

const screenIcons = {
  profile: Users,
  matches: Users,
  booking: MapPin,
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
            <strong>
              {landingMockupBrand.nameLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </strong>
            <small>{landingMockupBrand.tagline}</small>
          </span>
          <span className="pm-app-mockup-live">
            <span className="pm-app-mockup-live-dot" />
            Live
          </span>
        </div>

        <div className="pm-app-mockup-carousel">
          <div className="pm-app-mockup-screen-track">
            {landingMockupCarouselScreens.map((screen) => {
              const Icon = screenIcons[screen.sourceKey ?? screen.key] ?? Users;
              return (
                <section
                  className={`pm-app-mockup-screen pm-app-mockup-screen-${screen.tone}`}
                  key={screen.key}
                >
                  <div className="pm-app-mockup-screen-hero">
                    <span className="pm-app-mockup-screen-icon">
                      <Icon size={20} strokeWidth={2.5} />
                    </span>
                    <span className="pm-app-mockup-screen-copy">
                      <span className="pm-app-mockup-kicker">{screen.eyebrow}</span>
                      <strong>{screen.title}</strong>
                      <small>{screen.detail}</small>
                    </span>
                    <span className="pm-app-mockup-screen-metric">{screen.metric}</span>
                  </div>

                  <div className="pm-app-mockup-screen-cards">
                    {screen.cards.map((card, cardIndex) => (
                      <div className="pm-app-mockup-screen-card" key={card.label}>
                        <span className="pm-app-mockup-screen-card-dot">{cardIndex + 1}</span>
                        <span className="pm-app-mockup-screen-card-copy">
                          <span>{card.label}</span>
                          <strong>{card.value}</strong>
                          <small>{card.detail}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="pm-app-mockup-dots">
          {landingMockupScreens.map((screen, index) => (
            <span key={screen.key} style={{ '--pm-dot-index': index }} />
          ))}
        </div>
      </div>
    </figure>
  );
}

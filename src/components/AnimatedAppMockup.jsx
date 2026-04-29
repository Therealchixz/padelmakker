import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, TrendingUp, Users } from 'lucide-react';
import {
  getLandingMockupAriaLabel,
  landingMockupBrand,
  landingMockupCarouselScreens,
  landingMockupScreens,
} from '../lib/landingMockupSteps';

const MOCKUP_SCREEN_HOLD_MS = 3200;
const MOCKUP_TRANSITION_MS = 560;
const MOCKUP_SCREEN_WIDTH_PERCENT = 100 / landingMockupCarouselScreens.length;
const LOOP_CLONE_INDEX = landingMockupCarouselScreens.length - 1;

const screenIcons = {
  profile: Users,
  matches: Users,
  booking: MapPin,
  elo: TrendingUp,
};

export function AnimatedAppMockup({ className = '' }) {
  const resetFrameRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [motionEnabled, setMotionEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setMotionEnabled(!mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (resetFrameRef.current !== null) {
        window.cancelAnimationFrame(resetFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!motionEnabled) {
      setTransitionEnabled(false);
      setActiveIndex(0);
      return undefined;
    }

    if (activeIndex === LOOP_CLONE_INDEX) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setTransitionEnabled(true);
      setActiveIndex((index) => Math.min(index + 1, LOOP_CLONE_INDEX));
    }, MOCKUP_SCREEN_HOLD_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeIndex, motionEnabled]);

  const handleTrackTransitionEnd = useCallback((event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return;
    }

    if (activeIndex !== LOOP_CLONE_INDEX) {
      return;
    }

    setTransitionEnabled(false);
    resetFrameRef.current = window.requestAnimationFrame(() => {
      setActiveIndex(0);
      resetFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
        resetFrameRef.current = null;
      });
    });
  }, [activeIndex]);

  const activeScreenKey =
    landingMockupCarouselScreens[activeIndex]?.sourceKey ??
    landingMockupCarouselScreens[activeIndex]?.key ??
    landingMockupScreens[0].key;

  const trackStyle = {
    transform: `translate3d(-${activeIndex * MOCKUP_SCREEN_WIDTH_PERCENT}%, 0, 0)`,
    transition: transitionEnabled && motionEnabled
      ? `transform ${MOCKUP_TRANSITION_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`
      : 'none',
  };

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
          <div
            className="pm-app-mockup-screen-track"
            onTransitionEnd={handleTrackTransitionEnd}
            style={trackStyle}
          >
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
            <span
              className={screen.key === activeScreenKey ? 'is-active' : undefined}
              key={screen.key}
              style={{ '--pm-dot-index': index }}
            />
          ))}
        </div>
      </div>
    </figure>
  );
}

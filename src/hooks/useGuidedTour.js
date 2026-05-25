import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GUIDED_TOUR_VERSION, buildGuidedTourSteps } from '../lib/guidedTourSteps';

import { isPushSupported, subscribeToPush } from '../lib/pushNotifications';



const TOUR_PROMPT_DELAY_MS = 2500;



/**

 * @param {object} opts

 * @param {string | undefined} opts.userId

 * @param {string} opts.tab

 * @param {(tabId: string, opts?: { search?: string }) => void} opts.setTab

 * @param {(msg: string) => void} [opts.showToast]

 * @param {() => void} [opts.onCloseMobileMore]

 * @param {(open: boolean) => void} [opts.onMobileMoreOpenChange]

 */

export function useGuidedTour({

  userId,

  tab,

  setTab,

  showToast,

  onCloseMobileMore,

  onMobileMoreOpenChange,

}) {

  const [tourOpen, setTourOpen] = useState(false);

  const [tourPromptOpen, setTourPromptOpen] = useState(false);

  const [tourStepIndex, setTourStepIndex] = useState(0);

  const [isMobileView, setIsMobileView] = useState(false);

  const [forceAccountMenuOpen, setForceAccountMenuOpen] = useState(false);

  const hasScheduledPromptRef = useRef(false);



  const tourStorageKey = userId ? `pm_dash_tour_v${GUIDED_TOUR_VERSION}_done_${userId}` : null;



  const tabTourSelector = useCallback(

    (tabId) => (isMobileView ? `[data-tour="mobile-tab-${tabId}"]` : `[data-tour="tab-${tabId}"]`),

    [isMobileView],

  );



  const tourSteps = useMemo(

    () => buildGuidedTourSteps(isMobileView, tabTourSelector),

    [isMobileView, tabTourSelector],

  );



  const tourOnNotificationStep =

    tourOpen && tourSteps[tourStepIndex]?.id === 'notification-bell';



  const mobileMoreTourActive =

    tourOpen && tourSteps[tourStepIndex]?.id === 'mobile-more';



  const persistTourCompleted = useCallback(() => {

    if (!tourStorageKey) return;

    try {

      localStorage.setItem(tourStorageKey, '1');

    } catch {

      /* ignore */

    }

  }, [tourStorageKey]);



  const startTour = useCallback(() => {

    setTourPromptOpen(false);

    onCloseMobileMore?.();

    setForceAccountMenuOpen(false);

    setTourStepIndex(0);

    setTourOpen(true);

  }, [onCloseMobileMore]);



  const closeTour = useCallback(

    (withToastMessage) => {

      persistTourCompleted();

      setTourOpen(false);

      setTourStepIndex(0);

      setForceAccountMenuOpen(false);

      onCloseMobileMore?.();

      onMobileMoreOpenChange?.(false);

      if (withToastMessage && showToast) showToast(withToastMessage);

    },

    [persistTourCompleted, showToast, onCloseMobileMore, onMobileMoreOpenChange],

  );



  const handleTourBack = useCallback(() => {

    setTourStepIndex((prev) => Math.max(0, prev - 1));

  }, []);



  const handleTourNext = useCallback(() => {

    if (tourSteps[tourStepIndex]?.id === 'push-notifications' && userId && isPushSupported()) {

      void subscribeToPush(userId);

    }

    setTourStepIndex((prev) => Math.min(tourSteps.length - 1, prev + 1));

  }, [tourSteps, tourStepIndex, userId]);



  const handleTourPromptAccept = useCallback(() => {

    startTour();

  }, [startTour]);



  const handleTourPromptDecline = useCallback(() => {

    setTourPromptOpen(false);

    persistTourCompleted();

    showToast?.('Du finder guiden under dit navn → Start guide.');

  }, [persistTourCompleted, showToast]);



  const handleTourPromptDefer = useCallback(() => {

    setTourPromptOpen(false);

  }, []);



  useEffect(() => {

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const media = window.matchMedia('(max-width: 768px)');

    const onChange = (event) => setIsMobileView(event.matches);

    setIsMobileView(media.matches);

    if (typeof media.addEventListener === 'function') {

      media.addEventListener('change', onChange);

      return () => media.removeEventListener('change', onChange);

    }

    media.addListener(onChange);

    return () => media.removeListener(onChange);

  }, []);



  useEffect(() => {

    hasScheduledPromptRef.current = false;

  }, [tourStorageKey]);



  useEffect(() => {

    if (!tourStorageKey) return undefined;

    if (hasScheduledPromptRef.current) return undefined;

    hasScheduledPromptRef.current = true;



    let alreadyCompleted = false;

    try {

      alreadyCompleted = localStorage.getItem(tourStorageKey) === '1';

    } catch {

      alreadyCompleted = false;

    }

    if (alreadyCompleted) return undefined;



    const timer = window.setTimeout(() => {

      setTourPromptOpen(true);

    }, TOUR_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);

  }, [tourStorageKey]);



  useEffect(() => {

    if (!tourOpen) return;

    const step = tourSteps[tourStepIndex];

    if (step?.id === 'notification-bell') {

      setForceAccountMenuOpen(false);

      return;

    }

    const shouldOpen = Boolean(step?.openAccountMenu);

    setForceAccountMenuOpen((cur) => (cur === shouldOpen ? cur : shouldOpen));

  }, [tourOpen, tourStepIndex, tourSteps]);



  useEffect(() => {

    if (!tourOpen) {

      onMobileMoreOpenChange?.(false);

      return;

    }

    const step = tourSteps[tourStepIndex];

    onMobileMoreOpenChange?.(step?.id === 'mobile-more');

  }, [tourOpen, tourStepIndex, tourSteps, onMobileMoreOpenChange]);



  useEffect(() => {

    if (!tourOpen) return;

    const step = tourSteps[tourStepIndex];

    if (!step) return;



    if (step.tab && tab !== step.tab) {

      setTab(step.tab);

      return;

    }



    const target = step.selector ? document.querySelector(step.selector) : null;

    if (target && !step.skipScroll && typeof target.scrollIntoView === 'function') {

      target.scrollIntoView({
        behavior: 'smooth',
        block: step.scrollBlock || 'center',
        inline: 'nearest',
      });

    }

  }, [tourOpen, tourStepIndex, tourSteps, tab, setTab]);



  return {

    tourOpen,

    tourPromptOpen,

    tourSteps,

    tourStepIndex,

    tourOnNotificationStep,

    mobileMoreTourActive,

    forceAccountMenuOpen,

    startTour,

    handleTourBack,

    handleTourNext,

    handleTourPromptAccept,

    handleTourPromptDecline,

    handleTourPromptDefer,

    handleTourSkip: () => closeTour('Guiden er lukket. Du kan starte den igen fra menuen ved dit navn.'),

    handleTourFinish: () => {

      closeTour('Guide gennemført. God fornøjelse!');

      setTab('hjem');

    },

  };

}


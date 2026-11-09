import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Telefonens tilbage (Android-knappen, swipe i iOS-appen, browserens pil) lukker et
 * ark eller vindue i stedet for at forlade siden under det.
 *
 * Naar vinduet aabnes, laegges et skridt i historikken (samme adresse, med en markering).
 * Tilbage fjerner skridtet, og vinduet lukker. Lukkes vinduet med en knap, fjerner vi
 * selv skridtet igen, saa historikken ikke vokser.
 *
 * @param {boolean} open
 * @param {(() => void) | undefined} onClose
 * @param {string} key  unikt navn for vinduet, fx "spil"
 */
export function useCloseOnBack(open, onClose, key) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'idle' = intet skridt; 'pending' = skridtet er bedt om; 'active' = vi staar paa skridtet.
  const phase = useRef('idle');
  const onCloseRef = useRef(onClose);
  const locRef = useRef(location);
  useEffect(() => {
    onCloseRef.current = onClose;
    locRef.current = location;
  });

  // Aabnet: laeg et skridt i historikken.
  useEffect(() => {
    if (!open || phase.current !== 'idle') return;
    const loc = locRef.current;
    phase.current = 'pending';
    navigate(`${loc.pathname}${loc.search}${loc.hash}`, { state: { ...(loc.state || {}), pmOverlay: key } });
  }, [open, key, navigate]);

  // Historikken skiftede: staar vi paa vores skridt, er det aktivt; er vi gaaet vaek fra det
  // (tilbage), lukker vinduet.
  useEffect(() => {
    if (phase.current === 'idle') return;
    if (location.state?.pmOverlay === key) {
      phase.current = 'active';
      return;
    }
    if (phase.current !== 'active') return; // skridtet er ikke lagt endnu
    phase.current = 'idle';
    if (open) onCloseRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun naar historikken skifter
  }, [location.key]);

  // Lukket med en knap: fjern vores skridt igen (kun hvis vi stadig staar paa det).
  useEffect(() => {
    if (open || phase.current === 'idle') return;
    phase.current = 'idle';
    if (locRef.current.state?.pmOverlay === key) navigate(-1);
  }, [open, key, navigate]);

  // Fjernet fra siden mens det var aabent (fx valgt noget, der skifter side): ryd op.
  useEffect(() => () => {
    if (phase.current !== 'idle' && locRef.current.state?.pmOverlay === key) {
      phase.current = 'idle';
      window.history.back();
    }
  }, [key]);
}

import { useState } from 'react';
import { AppModal } from './AppModal';
import { CityPlaceSearchField } from './CityPlaceSearchField';
import { theme, btn, inputStyle, font } from '../lib/platformTheme';
import {
  isValidCityPlace,
  hasIncompleteCityProfile,
  resolveCityPlaceFromName,
} from '../lib/dawaPlaceSearch';

/**
 * Blokerende modal: kræver by + koordinater før dashboard kan bruges.
 * Vis når profil mangler DAWA-sted (ingen by eller by uden lat/lng).
 */
export function CityRequiredModal({ open, user, onSaved, showToast }) {
  const incomplete = hasIncompleteCityProfile(user);
  const [place, setPlace] = useState(null);
  const [saving, setSaving] = useState(false);

  const savePlace = async (resolved) => {
    if (!isValidCityPlace(resolved) || !onSaved) return false;
    await onSaved({
      city: resolved.city,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    });
    showToast?.('By gemt — afstande vises nu på Makkere', 'success');
    return true;
  };

  const handleConfirmStored = async () => {
    const name = String(user?.city || '').trim();
    if (!name) return;
    setSaving(true);
    try {
      const resolved = await resolveCityPlaceFromName(name);
      if (!resolved) {
        showToast?.('Kunne ikke finde byen automatisk — vælg fra listen.', 'error');
        return;
      }
      setPlace(resolved);
      await savePlace(resolved);
    } catch (e) {
      showToast?.(e?.message || 'Kunne ikke slå by op', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isValidCityPlace(place)) {
      showToast?.('Vælg din by fra listen', 'error');
      return;
    }
    setSaving(true);
    try {
      await savePlace(place);
    } catch (e) {
      showToast?.(e?.message || 'Kunne ikke gemme by', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={() => {}}
      closeOnBackdrop={false}
      closeOnEscape={false}
      ariaLabel={incomplete ? 'Bekræft din by' : 'Tilføj din by'}
      maxWidthPreset="sm"
      zIndex={1200}
      footer={(
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          {incomplete ? (
            <button
              type="button"
              onClick={() => { void handleConfirmStored(); }}
              disabled={saving}
              style={{ ...btn(false), fontSize: 13, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Gemmer…' : `Bekræft ${user.city}`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving || !isValidCityPlace(place)}
            style={{ ...btn(true), fontSize: 13, opacity: saving || !isValidCityPlace(place) ? 0.55 : 1 }}
          >
            {saving ? 'Gemmer…' : 'Gem by'}
          </button>
        </div>
      )}
    >
      <div style={{ fontFamily: font, padding: '4px 2px 8px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
          {incomplete ? 'Bekræft din by' : 'Tilføj din by'}
        </div>
        <p style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, marginBottom: 14 }}>
          {incomplete ? (
            <>
              Du har angivet &quot;{user.city}&quot;, men vi mangler præcis placering for at vise ca. afstand til andre makkere.
              Bekræft byen eller vælg den fra listen.
            </>
          ) : (
            <>
              Vælg din by, så andre kan se ca. afstand til dig på Makkere, og vi kan tippe dig om kampe i nærheden.
              Vi følger dig ikke med GPS.
            </>
          )}
        </p>
        <CityPlaceSearchField
          id="city-required-modal"
          required
          value={place}
          onChange={setPlace}
          seedQuery={user?.city || ''}
          inputStyle={{ ...inputStyle, marginBottom: 0 }}
          placeholder="Søg efter by eller postnummer…"
        />
      </div>
    </AppModal>
  );
}

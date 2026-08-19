import { useEffect, useId, useRef, useState } from 'react';
import { theme, font } from '../lib/platformTheme';
import { searchDawaPlaces, isValidCityPlace } from '../lib/dawaPlaceSearch.js';
import { fieldValidationErrorStyle } from '../lib/formValidationScroll.js';

const listStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'calc(100% + 4px)',
  zIndex: 40,
  margin: 0,
  padding: '6px 0',
  listStyle: 'none',
  background: theme.surface,
  border: `1.5px solid ${theme.border}`,
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(13,39,82,0.12)',
  maxHeight: 240,
  overflowY: 'auto',
};

const itemBtnStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  fontFamily: font,
  fontSize: 13,
  fontWeight: 500,
  color: theme.text,
  padding: '10px 14px',
  cursor: 'pointer',
};

/**
 * DAWA-baseret bysøgning. value = { city, latitude, longitude, label } | null.
 */
export function CityPlaceSearchField({
  id,
  value,
  onChange,
  inputStyle = {},
  placeholder = 'Søg efter by eller postnummer…',
  required = false,
  error = '',
  hint = '',
  disabled = false,
  seedQuery = '',
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState(() => {
    if (isValidCityPlace(value)) return value.label || value.city;
    return String(seedQuery || '').trim();
  });
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (isValidCityPlace(value)) {
      setQuery(value.label || value.city);
    } else if (String(seedQuery || '').trim()) {
      setQuery(String(seedQuery).trim());
    }
  }, [value?.city, value?.latitude, value?.longitude, value?.label, seedQuery]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setSearchError('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setSearchError('');
    const timer = window.setTimeout(() => {
      searchDawaPlaces(q)
        .then((items) => {
          if (cancelled) return;
          setSuggestions(items);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setLoading(false);
          setSearchError('Kunne ikke hente byforslag. Prøv igen.');
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const handleInputChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    if (isValidCityPlace(value)) {
      const same = next.trim() === String(value.label || value.city).trim();
      if (!same) onChange?.(null);
    }
  };

  const selectPlace = (place) => {
    onChange?.({
      id: place.id,
      label: place.label,
      city: place.city,
      latitude: place.latitude,
      longitude: place.longitude,
      source: place.source,
    });
    setQuery(place.label);
    setOpen(false);
    setSuggestions([]);
  };

  const showError = Boolean(error);
  const mergedInputStyle = {
    ...inputStyle,
    ...(showError ? fieldValidationErrorStyle : {}),
  };

  return (
    <div ref={wrapRef} data-pm-field="city" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required={required || undefined}
        aria-invalid={showError || undefined}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        style={mergedInputStyle}
        onFocus={() => setOpen(true)}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {loading ? (
        <div style={{ fontSize: 11, color: theme.textLight, marginTop: 6 }}>Søger…</div>
      ) : null}
      {searchError ? (
        <div style={{ fontSize: 11, color: theme.red, marginTop: 6 }} role="alert">{searchError}</div>
      ) : null}
      {showError ? (
        <div style={{ fontSize: 11, color: theme.red, marginTop: 6 }} role="alert">{error}</div>
      ) : null}
      {!showError && hint ? (
        <div style={{ fontSize: 11, color: theme.textLight, marginTop: 6 }}>{hint}</div>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul id={listId} role="listbox" style={listStyle}>
          {suggestions.map((place) => (
            <li key={place.id} role="option">
              <button type="button" style={itemBtnStyle} onMouseDown={(e) => e.preventDefault()} onClick={() => selectPlace(place)}>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

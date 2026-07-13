import {
  SquareParking,
  Shirt,
  Coffee,
  ShoppingBag,
  Droplets,
  Wifi,
  UtensilsCrossed,
  Dumbbell,
} from 'lucide-react';

/**
 * Katalog over kendte bane-faciliteter: nøgle → dansk label + ikon.
 * Nøglerne gemmes i courts.facilities (text[]).
 */
export const COURT_FACILITY_CATALOG = [
  { key: 'parking', label: 'Parkering', Icon: SquareParking },
  { key: 'changing_rooms', label: 'Omklædning', Icon: Shirt },
  { key: 'showers', label: 'Bad', Icon: Droplets },
  { key: 'cafe', label: 'Café/Lounge', Icon: Coffee },
  { key: 'restaurant', label: 'Restaurant', Icon: UtensilsCrossed },
  { key: 'pro_shop', label: 'Pro-shop', Icon: ShoppingBag },
  { key: 'equipment_rental', label: 'Udstyrsudlejning', Icon: Dumbbell },
  { key: 'wifi', label: 'Gratis WiFi', Icon: Wifi },
];

const FACILITY_BY_KEY = Object.fromEntries(COURT_FACILITY_CATALOG.map((f) => [f.key, f]));

export function getFacilityMeta(key) {
  return FACILITY_BY_KEY[key] || null;
}

export function facilityLabel(key) {
  return FACILITY_BY_KEY[key]?.label || key;
}

/** Normalisér en faciliteter-liste til kendte nøgler i katalog-rækkefølge. */
export function normalizeFacilities(facilities) {
  if (!Array.isArray(facilities)) return [];
  const set = new Set(facilities.map((f) => String(f)));
  return COURT_FACILITY_CATALOG.filter((f) => set.has(f.key)).map((f) => f.key);
}

/**
 * "Faciliteter på centret" inset-kort — grid med ikon + label pr. facilitet.
 * Returnerer null hvis der ingen kendte faciliteter er.
 */
export function CourtFacilitiesGrid({ facilities, title = 'Faciliteter på centret', style }) {
  const keys = normalizeFacilities(facilities);
  if (keys.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--pm-surface-muted)',
        border: '1px solid var(--pm-border)',
        borderRadius: 14,
        padding: '13px 15px',
        ...style,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--pm-text)', marginBottom: 10 }}>
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 14px',
        }}
      >
        {keys.map((key) => {
          const meta = FACILITY_BY_KEY[key];
          const Icon = meta.Icon;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--pm-text-mid)' }}>
              <Icon size={16} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--pm-accent)' }} aria-hidden />
              {meta.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

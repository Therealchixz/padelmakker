import { DateTime } from 'luxon';

const BOOKLI_GQL = 'https://api.bookli.app/graphql';
const UA = 'PadelMakkerBookli/1.0 (+https://www.padelmakker.dk)';

const Q_CATEGORIES = `
query GetResourceCategories($isPublic: Boolean, $locationId: String) {
  resourceCategories(isPublic: $isPublic, locationId: $locationId) {
    data {
      id
      name
    }
  }
}
`;

const Q_TIMELINE = `
query GetResourcesLocationTimeline($resourceCategory: ID, $date: DateTime!, $location: ID!, $isPublic: Boolean) {
  resourcesLocationTimeline(resourceCategory: $resourceCategory, date: $date, location: $location, isPublic: $isPublic) {
    openTimeUtc
    closeTimeUtc
    latestDateForBooking
    resources {
      id
      name
      shortName
    }
    resourceBookings {
      id
      startDate
      endDate
      resourceId
    }
  }
}
`;

function isMeetingRoom(name) {
  return /møde|mødelokale|meeting/i.test(String(name || ''));
}

/**
 * PadelPadel Aalborg: D1–D9 = double, SS* = single, Center Court = showpiece.
 * @returns {{ label: string } | null} null = ingen ekstra tag
 */
function padelpadelCourtKindLabel(name, shortName) {
  const raw = String(shortName || name || '').trim();
  const upper = raw.toUpperCase();
  const full = `${name || ''} ${shortName || ''}`.toUpperCase();

  if (/^SS\d*$/i.test(raw) || /\bSS\d+\b/i.test(full)) {
    return { label: 'Singlebane' };
  }
  if (/^D\d+$/i.test(raw) || /^D\d+\s*$/i.test(String(name || '').trim())) {
    return { label: 'Doublebane' };
  }
  if (/CENTER\s*COURT|\bCC\d+/i.test(full)) {
    return { label: 'Center court' };
  }
  return null;
}

/**
 * @param {string} dateYmd YYYY-MM-DD i locationTZ
 * @param {{ locationId: string, resourceCategoryId: string, timezone: string }} cfg
 */
export async function fetchBookliTimelineForDate(dateYmd, cfg) {
  const zone = cfg.timezone || 'Europe/Copenhagen';

  const day = DateTime.fromISO(dateYmd, { zone });
  if (!day.isValid) {
    return { error: 'Ugyldig dato' };
  }

  /** Midt på dagen i lokaltid → UTC (startOf('day').toUTC() rammer “i går” i Z og Bookli siger “past date”) */
  const dateIso = day.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO();

  const res = await fetch(BOOKLI_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      query: Q_TIMELINE,
      variables: {
        resourceCategory: cfg.resourceCategoryId,
        date: dateIso,
        location: cfg.locationId,
        isPublic: true,
      },
    }),
  });

  if (!res.ok) {
    return { error: `Bookli fejl: ${res.status}` };
  }

  const json = await res.json();
  if (json.errors?.length) {
    return { error: json.errors.map((e) => e.message).join('; ') };
  }

  const tl = json.data?.resourcesLocationTimeline;
  if (!tl) {
    return { error: 'Tomt svar fra Bookli' };
  }

  const openParts = String(tl.openTimeUtc || '05:00:00').split(':').map(Number);
  const closeParts = String(tl.closeTimeUtc || '00:00:00').split(':').map(Number);
  const openH = openParts[0] ?? 5;
  const openM = openParts[1] ?? 0;
  const closeH = closeParts[0] ?? 0;
  const closeM = closeParts[1] ?? 0;

  let openDt = day.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
  /** "00:00" lukketid = midnat slutningen af dagen (næste dags 00:00) */
  let closeDt =
    closeH === 0 && closeM === 0
      ? day.plus({ days: 1 }).startOf('day')
      : day.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

  if (closeDt <= openDt) {
    closeDt = closeDt.plus({ days: 1 });
  }

  const stepMin = 30;
  const resources = (tl.resources || []).filter((r) => !isMeetingRoom(r.name) && !isMeetingRoom(r.shortName));

  const bookingsByResource = new Map();
  for (const b of tl.resourceBookings || []) {
    const rid = b.resourceId;
    if (!bookingsByResource.has(rid)) bookingsByResource.set(rid, []);
    bookingsByResource.get(rid).push(b);
  }

  const courts = resources.map((r) => {
    const bookings = bookingsByResource.get(r.id) || [];
    const ranges = bookings.map((b) => ({
      start: DateTime.fromISO(b.startDate, { zone: 'utc' }).setZone(zone),
      end: DateTime.fromISO(b.endDate, { zone: 'utc' }).setZone(zone),
    }));

    const slots = [];
    let t = openDt;
    const now = DateTime.now().setZone(zone);

    while (t < closeDt) {
      const slotEnd = t.plus({ minutes: stepMin });
      const timeLabel = t.toFormat('HH:mm');

      let status = 'free';
      if (t < now) {
        status = 'unavailable';
      } else {
        for (const { start: bs, end: be } of ranges) {
          if (t < be && slotEnd > bs) {
            status = 'booked';
            break;
          }
        }
      }

      slots.push({ time: timeLabel, status });
      t = slotEnd;
    }

    const kind = padelpadelCourtKindLabel(r.name, r.shortName);
    const nameStr = String(r.name || r.shortName || 'Bane').trim();
    const headerName = kind ? `${nameStr} — ${kind.label}` : nameStr;

    return {
      id: r.id,
      name: r.name,
      shortName: r.shortName,
      headerName,
      slots,
      available: slots.filter((s) => s.status === 'free').map((s) => s.time),
    };
  });

  let latestBook = null;
  if (tl.latestDateForBooking) {
    latestBook = DateTime.fromISO(tl.latestDateForBooking, { zone: 'utc' }).setZone(zone).toISODate();
  }

  return {
    dateLabel: day.setLocale('da').toFormat("cccc d. MMMM yyyy"),
    date: day.toISODate(),
    slotStepMinutes: stepMin,
    openLocal: openDt.toFormat('HH:mm'),
    closeLocal: closeDt.toFormat('HH:mm'),
    latestBookableDate: latestBook,
    courts,
  };
}

/** Hent Padel-kategori-id hvis ikke sat (sjældent nødvendigt) */
export async function fetchPadelCategoryId(locationId) {
  const res = await fetch(BOOKLI_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      query: Q_CATEGORIES,
      variables: { isPublic: true, locationId },
    }),
  });
  const json = await res.json();
  const data = json.data?.resourceCategories?.data || [];
  const padel = data.find((c) => /padel/i.test(c.name || ''));
  return padel?.id || null;
}

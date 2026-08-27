import { supabase } from './supabase';
import { mapInviteMatchOptions } from './inviteMatchOptionsMap';

const TTL_MS = 45_000;
/** @type {Map<string, { items: object[] | null, at: number, promise: Promise<object[]> | null }>} */
const cache = new Map();

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function getCachedInviteMatchOptions(userId) {
  const row = cache.get(String(userId || ''));
  return row?.items ?? null;
}

async function fetchInviteMatchOptions(userId) {
  const [matchRes, tourRes] = await Promise.all([
    supabase
      .from('matches')
      .select('id, date, time, court_name, description, status')
      .eq('creator_id', userId)
      .in('status', ['open', 'full'])
      .order('date', { ascending: true })
      .limit(10),
    supabase
      .from('americano_tournaments')
      .select('id, name, tournament_date, time_slot, description, status')
      .eq('creator_id', userId)
      .in('status', ['registration', 'in_progress'])
      .order('tournament_date', { ascending: true })
      .limit(10),
  ]);
  return mapInviteMatchOptions(matchRes.data, tourRes.data, todayYmd());
}

export function loadInviteMatchOptions(userId) {
  const key = String(userId || '');
  if (!key) return Promise.resolve([]);
  const existing = cache.get(key);
  if (existing?.promise) return existing.promise;
  if (existing?.items && Date.now() - existing.at < TTL_MS) {
    return Promise.resolve(existing.items);
  }

  const promise = fetchInviteMatchOptions(key)
    .then((items) => {
      cache.set(key, { items, at: Date.now(), promise: null });
      return items;
    })
    .catch((err) => {
      const prev = cache.get(key);
      cache.set(key, { items: prev?.items ?? [], at: 0, promise: null });
      throw err;
    });

  cache.set(key, { items: existing?.items ?? null, at: existing?.at || 0, promise });
  return promise;
}

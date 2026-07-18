/**
 * Cloud-favoritter (user_favorites) med localStorage som cache/fallback.
 */

import { supabase } from './supabase.js';

function favoritesKeyForUser(userId) {
  return userId != null && String(userId).trim() !== ''
    ? `pm_favorites_${String(userId)}`
    : null;
}

export function readLocalFavoritesSet(userId) {
  const key = favoritesKeyForUser(userId);
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]').map(String));
  } catch {
    return new Set();
  }
}

export function writeLocalFavoritesSet(userId, set) {
  const key = favoritesKeyForUser(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* quota */
  }
}

/** Hent favoritter fra DB. */
export async function fetchCloudFavorites(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('user_favorites')
    .select('favorite_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => String(r.favorite_id)));
}

/**
 * Load: merge cloud + local, push manglende local→cloud, returnér union.
 */
export async function loadFavoritesForUser(userId) {
  const local = readLocalFavoritesSet(userId);
  if (!userId) return local;

  try {
    const cloud = await fetchCloudFavorites(userId);
    const merged = new Set([...cloud, ...local]);

    const missingInCloud = [...merged].filter((id) => !cloud.has(id));
    if (missingInCloud.length > 0) {
      const rows = missingInCloud.map((favorite_id) => ({
        user_id: userId,
        favorite_id,
      }));
      const { error } = await supabase.from('user_favorites').upsert(rows, {
        onConflict: 'user_id,favorite_id',
        ignoreDuplicates: true,
      });
      if (error) console.warn('user_favorites migrate local→cloud:', error.message || error);
    }

    writeLocalFavoritesSet(userId, merged);
    return merged;
  } catch (e) {
    console.warn('loadFavoritesForUser fallback local:', e?.message || e);
    return local;
  }
}

export async function addFavorite(userId, favoriteId) {
  const id = String(favoriteId);
  if (!userId || !id || id === String(userId)) return;
  const { error } = await supabase.from('user_favorites').upsert(
    { user_id: userId, favorite_id: id },
    { onConflict: 'user_id,favorite_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  const next = readLocalFavoritesSet(userId);
  next.add(id);
  writeLocalFavoritesSet(userId, next);
}

export async function removeFavorite(userId, favoriteId) {
  const id = String(favoriteId);
  if (!userId || !id) return;
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('favorite_id', id);
  if (error) throw error;
  const next = readLocalFavoritesSet(userId);
  next.delete(id);
  writeLocalFavoritesSet(userId, next);
}

export async function toggleFavoriteForUser(userId, favoriteId) {
  const id = String(favoriteId);
  const current = readLocalFavoritesSet(userId);
  if (current.has(id)) {
    await removeFavorite(userId, id);
    current.delete(id);
  } else {
    await addFavorite(userId, id);
    current.add(id);
  }
  return current;
}

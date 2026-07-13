import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const BUCKET = 'match-photos';

/** Hent alle billeder for en kamp, nyeste først. */
export async function fetchMatchPhotos(matchId) {
  if (!matchId) return [];
  const { data, error } = await supabase
    .from('match_photos')
    .select('id, match_id, user_id, storage_path, url, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Upload ét billede til en kamp og opret rækken i match_photos. */
export async function uploadMatchPhoto(matchId, userId, file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Kun JPG, PNG og WebP billeder er tilladt.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Billedet er for stort — maks 6 MB.');
  }
  const rawExt = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${matchId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { data: row, error: insErr } = await supabase
    .from('match_photos')
    .insert({ match_id: matchId, user_id: userId, storage_path: path, url })
    .select('id, match_id, user_id, storage_path, url, created_at')
    .single();
  if (insErr) {
    // Ryd op i storage hvis DB-insert fejler
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw insErr;
  }
  return row;
}

/** Slet et billede (kun ejeren — håndhæves af RLS). */
export async function deleteMatchPhoto(photo) {
  if (!photo?.id) return;
  const { error } = await supabase.from('match_photos').delete().eq('id', photo.id);
  if (error) throw error;
  if (photo.storage_path) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => {});
  }
}

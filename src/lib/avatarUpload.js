import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function isAvatarUrl(avatar) {
  return typeof avatar === 'string' && avatar.startsWith('http');
}

export async function uploadAvatar(userId, file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Kun JPG, PNG og WebP billeder er tilladt.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Billedet er for stort — maks 2 MB.');
  }
  const rawExt = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  const path = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

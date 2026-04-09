import { supabase } from './supabase'

const BUCKET = 'avatars'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/i

/**
 * Upload til Supabase Storage bucket `avatars` (public).
 * Sti: {userId}/{timestamp}.{ext}
 * @returns {Promise<string>} public URL gemt i profiles.avatar
 */
export async function uploadProfileAvatar(userId, file) {
  if (!file || !userId) throw new Error('Manglende fil eller bruger')
  if (file.size > MAX_BYTES) throw new Error('Billedet må højst være 2 MB')
  if (!ALLOWED.test(file.type || '')) throw new Error('Brug JPEG, PNG, WebP eller GIF')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (upErr) throw new Error(upErr.message || 'Upload fejlede')

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = data?.publicUrl
  if (!url) throw new Error('Kunne ikke hente offentlig URL')
  return url
}

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { fetchMatchPhotos, uploadMatchPhoto, deleteMatchPhoto } from '../../lib/matchPhotos';
import { theme } from '../../lib/platformTheme';

/**
 * "Kampbilleder" — viser uploadede billeder for en afsluttet kamp.
 * Deltagere kan tilføje/slette egne billeder.
 */
export function MatchPhotosSection({ matchId, currentUserId, canUpload = false }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMatchPhotos(matchId)
      .then((rows) => { if (!cancelled) setPhotos(rows); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Kunne ikke hente billeder.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  const onPick = () => fileRef.current?.click();

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const row = await uploadMatchPhoto(matchId, currentUserId, file);
        setPhotos((prev) => [row, ...prev]);
      }
    } catch (err) {
      setError(err?.message || 'Upload fejlede.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (photo) => {
    setBusy(true);
    try {
      await deleteMatchPhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setLightbox(null);
    } catch (err) {
      setError(err?.message || 'Kunne ikke slette billedet.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (!canUpload && photos.length === 0) return null;

  return (
    <div style={{ padding: '6px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: theme.text, margin: 0 }}>Kampbilleder</h3>
        {canUpload ? (
          <button
            type="button"
            onClick={onPick}
            disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: theme.navy, fontWeight: 600, fontSize: 12.5, cursor: busy ? 'wait' : 'pointer', padding: 0 }}
          >
            <ImagePlus size={14} aria-hidden />
            {busy ? 'Uploader…' : 'Tilføj'}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onFiles}
          style={{ display: 'none' }}
        />
      </div>

      {error ? <div style={{ color: theme.red, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          style={{ width: '100%', padding: '18px', borderRadius: 14, border: `1.5px dashed ${theme.border}`, background: 'var(--pm-surface-muted)', color: theme.textLight, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <ImagePlus size={20} aria-hidden />
          Tilføj det første billede fra kampen
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}`, padding: 0, cursor: 'pointer', background: 'var(--pm-surface-muted)' }}
            >
              <img src={p.url} alt="Kampbillede" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Luk"
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'var(--pm-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt="Kampbillede"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }}
          />
          {String(lightbox.user_id) === String(currentUserId) ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(lightbox); }}
              disabled={busy}
              style={{ position: 'absolute', bottom: 'max(24px, env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 10, background: theme.red, color: 'var(--pm-on-accent)', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Slet billede
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

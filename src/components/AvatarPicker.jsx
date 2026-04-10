import { useRef } from 'react';
import { theme, btn } from '../lib/platformTheme';
import { isAvatarUrl } from '../lib/avatarUpload';

const EMOJIS = ['🎾', '👨', '👩', '🧔', '👩‍🦰', '👨‍🦱', '👩‍🦱', '🧑'];

/**
 * Lader brugeren vælge profilbillede (upload) eller emoji.
 *
 * Props:
 *   value       – nuværende avatar (URL eller emoji-streng)
 *   previewUrl  – midlertidig blob:-URL til forhåndsvisning (inden gem)
 *   uploading   – viser "Uploader…" tekst på knappen
 *   onFileSelect(file)   – kaldt med File-objekt når bruger vælger et billede
 *   onEmojiSelect(emoji) – kaldt med emoji-streng når bruger vælger en emoji
 */
export function AvatarPicker({ value, previewUrl, onFileSelect, onEmojiSelect, uploading = false }) {
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelect?.(file);
    e.target.value = ''; // reset så samme fil kan vælges igen
  };

  const displayAvatar = previewUrl || value;
  const showingImage = Boolean(previewUrl) || isAvatarUrl(displayAvatar);

  return (
    <div>
      {/* Forhåndsvisning + upload-knap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#F1F5F9',
          border: '2px solid #D5DDE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {showingImage
            ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '32px' }}>{displayAvatar || '🎾'}</span>
          }
        </div>
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ ...btn(true), marginBottom: '6px', fontSize: '13px', padding: '8px 14px' }}
          >
            {uploading ? 'Uploader…' : showingImage ? 'Skift billede' : 'Upload profilbillede'}
          </button>
          <div style={{ fontSize: '11px', color: theme.textLight, lineHeight: 1.4 }}>
            JPG, PNG eller WebP · Maks 2 MB
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Emoji-alternativ */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        Eller vælg emoji
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {EMOJIS.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => onEmojiSelect?.(e)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              fontSize: '20px',
              border: (!previewUrl && !isAvatarUrl(value) && value === e)
                ? '2px solid #1D4ED8'
                : '1px solid #D5DDE8',
              background: (!previewUrl && !isAvatarUrl(value) && value === e)
                ? '#EFF6FF'
                : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

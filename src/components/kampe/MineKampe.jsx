/**
 * "Mine kampe" (H-designet): vises øverst på Kort-siden, når man har valgt "Mine".
 * Kommende kampe som kort, et lime banner når et resultat mangler, og de spillede
 * kampe som rækker med Vundet/Tabt, score og ELO-ændring.
 * Al data kommer fra Kort-siden; denne fil er ren visning.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import '../../styles/mine-kampe.css';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function MineKampe({ upcoming, played, needsResult, onOpen, onCreate }) {
  const [view, setView] = useState('kommende');
  const showPlayed = view === 'spillede';
  return (
    <section className="pm-mine" aria-labelledby="pm-mine-title">
      <h2 id="pm-mine-title" className="pm-mine-title">Mine kampe</h2>
      <div className="pm-mine-seg" role="tablist" aria-label="Vis">
        <button type="button" role="tab" aria-selected={!showPlayed} onClick={() => setView('kommende')}>
          Kommende · {upcoming.length}
        </button>
        <button type="button" role="tab" aria-selected={showPlayed} onClick={() => setView('spillede')}>
          Spillede · {played.length}
        </button>
      </div>

      {needsResult.map((m) => (
        <button key={m.id} type="button" className="pm-mine-banner" onClick={() => onOpen(m.id)}>
          <span className="pm-mine-banner-text">
            <b>Indtast resultatet fra {m.whenLabel}</b>
            <small>{m.meta}</small>
          </span>
          <ChevronRight size={20} aria-hidden />
        </button>
      ))}

      {!showPlayed ? (
        upcoming.length > 0 ? (
          <div className="pm-mine-list">
            {upcoming.map((m) => (
              <button key={m.id} type="button" className="pm-mine-card" onClick={() => onOpen(m.id)}>
                <span className="pm-mine-card-top">
                  {m.inLabel ? <small>{m.inLabel}</small> : null}
                  <b>{m.whenLabel}</b>
                  <span>{m.court || 'Bane ikke valgt endnu'}</span>
                  {m.meta ? <small>{m.meta}</small> : null}
                </span>
                <span className="pm-mine-card-bottom">
                  <span className="pm-mine-faces" aria-hidden>
                    {m.players.slice(0, 4).map((name, i) => (
                      <span key={`${name}-${i}`} className="pm-mine-face">{initials(name)}</span>
                    ))}
                    {Array.from({ length: Math.max(0, Math.min(4, m.left)) }, (_, i) => (
                      <span key={`tom-${i}`} className="pm-mine-face pm-mine-face--empty" />
                    ))}
                  </span>
                  <span className="pm-mine-card-status">{m.left > 0 ? `Mangler ${m.left}` : 'Fuldt hold'}</span>
                  <span className="pm-mine-card-go">Åbn</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="pm-mine-empty">
            <p>Du har ingen kommende kampe.</p>
            <button type="button" className="pm-mine-empty-cta" onClick={onCreate}>Opret en kamp</button>
          </div>
        )
      ) : played.length > 0 ? (
        <div className="pm-mine-played">
          {played.map((m) => (
            <button key={m.id} type="button" className="pm-mine-row" onClick={() => onOpen(m.id)}>
              <span className="pm-mine-res" data-res={m.result}>
                {m.result === 'win' ? 'Vundet' : m.result === 'loss' ? 'Tabt' : 'Spillet'}
              </span>
              <span className="pm-mine-row-copy">
                <b>{m.score}</b>
                <small>{m.meta}</small>
              </span>
              {m.elo != null ? <span className="pm-mine-row-elo">{m.elo > 0 ? `+${m.elo}` : String(m.elo).replace('-', '−')}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="pm-mine-empty"><p>Du har ikke spillet nogen kampe endnu.</p></div>
      )}
    </section>
  );
}

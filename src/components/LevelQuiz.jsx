import { useState } from 'react';
import { font, theme } from '../lib/platformTheme';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { LEVEL_QUIZ, suggestLevelFromQuiz } from '../lib/levelQuiz.js';

/**
 * "Ikke sikker? Svar på 4 hurtige spørgsmål" under niveau-kortene ved
 * oprettelse. Viser ét spørgsmål ad gangen og til sidst et forslag.
 */
export function LevelQuiz({ onUse, onClose }) {
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const suggestion = suggestLevelFromQuiz(answers);
  const done = index >= LEVEL_QUIZ.length;
  const q = LEVEL_QUIZ[Math.min(index, LEVEL_QUIZ.length - 1)];

  const choose = (i) => {
    setAnswers((a) => ({ ...a, [q.id]: i }));
    setIndex((n) => n + 1);
  };

  const box = {
    background: theme.surface,
    border: `1.5px solid ${theme.border}`,
    borderRadius: 14,
    padding: '14px 14px 12px',
    margin: '4px 0 12px',
    fontFamily: font,
  };
  const optionStyle = {
    width: '100%',
    textAlign: 'left',
    background: theme.surface,
    border: `1.5px solid ${theme.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: theme.text,
    cursor: 'pointer',
    fontFamily: font,
  };
  const linkBtn = {
    border: 'none',
    background: 'transparent',
    color: theme.accent,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: 'pointer',
    padding: '4px 0',
    fontFamily: font,
  };

  return (
    <div style={box} role="group" aria-label="Find dit niveau">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textLight }}>
          {done ? 'Dit forslag' : `Spørgsmål ${index + 1} af ${LEVEL_QUIZ.length}`}
        </span>
        <button type="button" onClick={onClose} style={linkBtn}>Luk</button>
      </div>
      <div style={{ height: 5, background: theme.border, borderRadius: 9, marginBottom: 14 }}>
        <div
          style={{
            height: '100%',
            width: `${(Math.min(index, LEVEL_QUIZ.length) / LEVEL_QUIZ.length) * 100}%`,
            background: theme.navy,
            borderRadius: 9,
          }}
        />
      </div>

      {!done ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 12 }}>{q.question}</div>
          {q.options.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={answers[q.id] === i}
              style={{
                ...optionStyle,
                borderColor: answers[q.id] === i ? theme.accent : theme.border,
              }}
            >
              {label}
            </button>
          ))}
          {index > 0 ? (
            <button type="button" onClick={() => setIndex((n) => n - 1)} style={linkBtn}>← Tilbage</button>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ background: theme.navy, color: 'var(--pm-on-accent)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Vores bud på dit niveau</div>
            <div style={{ fontSize: 30, fontWeight: 800, margin: '2px 0' }}>ca. {formatPlaytomicLevel(suggestion)}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>
              Vi runder lidt ned – de fleste gætter for højt. Du kan altid rette det senere.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUse(suggestion)}
            style={{
              ...optionStyle,
              marginTop: 12,
              marginBottom: 4,
              textAlign: 'center',
              background: theme.navy,
              borderColor: theme.navy,
              color: 'var(--pm-on-accent)',
              fontWeight: 700,
            }}
          >
            Brug {formatPlaytomicLevel(suggestion)}
          </button>
          <button type="button" onClick={() => { setAnswers({}); setIndex(0); }} style={linkBtn}>Svar igen</button>
        </>
      )}
    </div>
  );
}

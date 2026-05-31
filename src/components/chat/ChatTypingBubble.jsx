export function ChatTypingBubble() {
  return (
    <div className="pm-chat-v2-typing-bubble" aria-label="Skriver…">
      {[0, 1, 2].map((i) => (
        <span key={i} className="pm-chat-v2-typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

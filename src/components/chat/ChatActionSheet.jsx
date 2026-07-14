import { createPortal } from 'react-dom';

export function ChatActionSheet({ open, title, onClose, children }) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button type="button" className="pm-chat-v2-sheet-backdrop" aria-label="Luk" onClick={onClose} />
      <div className="pm-chat-v2-action-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pm-chat-v2-action-sheet-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>Luk</button>
        </div>
        <div className="pm-chat-v2-action-sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

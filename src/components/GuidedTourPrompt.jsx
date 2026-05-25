import { createPortal } from 'react-dom';
import { Compass } from 'lucide-react';

export function GuidedTourPrompt({ open, onAccept, onDecline, onDefer }) {
  if (!open) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Guide til PadelMakker"
      className="fixed bottom-24 left-4 right-4 z-[10030] md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
    >
      <div className="rounded-2xl border border-pm-border bg-pm-surface p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pm-accent-bg text-pm-accent">
            <Compass size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-pm-text">Vil du have en kort rundtur?</p>
            <p className="mt-1 text-xs leading-relaxed text-pm-text-mid">
              2 minutter — makkere, kampe, book bane og mere.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-pm-accent px-4 py-2 text-xs font-extrabold text-white"
          >
            Ja, vis mig
          </button>
          <button
            type="button"
            onClick={onDefer}
            className="rounded-full border border-pm-border px-4 py-2 text-xs font-bold text-pm-text-mid"
          >
            Senere
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="rounded-full px-3 py-2 text-xs font-bold text-pm-text-light"
          >
            Nej tak
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

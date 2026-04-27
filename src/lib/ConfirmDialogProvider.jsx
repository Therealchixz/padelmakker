import { createContext, useCallback, useContext, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} message
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {boolean} [danger]
 * @property {boolean} [notice]
 */

/**
 * @typedef {(opts: string | ConfirmOptions) => Promise<boolean>} ConfirmFn
 */

/**
 * Promise-baseret in-app dialog der erstatter window.confirm() og window.alert().
 *
 * Brug:
 *   const ask = useConfirm();
 *   if (!(await ask('Slet denne kamp?'))) return;
 *   await ask({ message: 'Fejl: ' + e.message, notice: true });
 *
 * Confirm-mode (default): returnerer Promise<boolean> (true ved bekræft, false ved afbryd).
 * Notice-mode (notice=true): viser kun OK-knap; returnerer Promise<true> efter klik.
 *
 * @type {React.Context<ConfirmFn | null>}
 */
const ConfirmContext = createContext(/** @type {ConfirmFn | null} */ (null));

export function ConfirmDialogProvider({ children }) {
  const [config, setConfig] = useState(null);

  const ask = useCallback((opts) => {
    const normalized =
      typeof opts === 'string'
        ? { message: opts }
        : opts && typeof opts === 'object'
          ? opts
          : { message: '' };
    return new Promise((resolve) => {
      setConfig({ ...normalized, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (config?.resolve) config.resolve(true);
    setConfig(null);
  };

  const handleCancel = () => {
    if (config?.resolve) config.resolve(false);
    setConfig(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {config && (
        <ConfirmDialog
          message={config.message}
          confirmLabel={config.confirmLabel}
          cancelLabel={config.cancelLabel}
          danger={!!config.danger}
          notice={!!config.notice}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * @returns {ConfirmFn}
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm skal bruges inde i en ConfirmDialogProvider');
  }
  return ctx;
}

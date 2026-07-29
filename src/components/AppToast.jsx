/** @typedef {'success' | 'error' | 'info'} ToastType */

/**
 * @param {{ message: string, type: ToastType }} props
 */
export function AppToast({ message, type }) {
  const isError = type === 'error';
  return (
    <div
      className={`pm-toast pm-toast--${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="pm-toast-icon" aria-hidden="true">
        {type === 'success' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.2 6.4 11l6.1-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : type === 'error' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.75" />
            <path d="M8 7.2V11.5M8 4.8v.9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="pm-toast-msg">{message}</span>
    </div>
  );
}

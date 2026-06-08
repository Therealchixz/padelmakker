import { theme } from '../lib/platformTheme';

/**
 * Ensartet tom-tilstand-ikon (samme stil som Liga-fanen).
 * @param {object} props
 * @param {import('lucide-react').LucideIcon} props.icon
 * @param {number} [props.size]
 */
export function EmptyStateIcon({ icon: Icon, size = 44 }) {
  return (
    <Icon
      size={size}
      color={theme.border}
      strokeWidth={1.5}
      aria-hidden
      className="pm-empty-state-icon"
    />
  );
}

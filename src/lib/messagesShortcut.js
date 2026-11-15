import { createContext } from 'react';

/**
 * Genvej til Beskeder i den faelles toplinje (H-designet, etape 3).
 * Dashboardet leverer { unread, open }. Uden for dashboardet er den null,
 * og saa viser toplinjen ingen besked-knap.
 */
export const MessagesShortcutContext = createContext(null);

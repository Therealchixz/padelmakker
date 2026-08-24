import { buildKampeFocusPath, kampeFocusOpensChat, notificationKampeTarget } from './kampeFocusNavigation.js';
import {
  buildProposalFocusPath,
  isActionableProposalNotification,
  isProposalNotification,
  proposalIdFromNotification,
} from './playIntentUtils.js';

/**
 * Én klik-destination for klokke, notifikationsside og tests.
 * Returnerer null når beskeden ikke skal navigere (kun markér som læst).
 */
export function resolveNotificationClickTarget(n, { isAdmin = false } = {}) {
  if (!n) return null;
  const type = String(n?.type || '');

  if (type === 'result_error_report' && isAdmin) {
    return { kind: 'admin', path: '/dashboard/admin?adminSub=result_errors' };
  }
  if (type === 'user_report' && isAdmin) {
    return { kind: 'admin', path: '/dashboard/admin?adminSub=reports' };
  }
  if (type === 'makker_suggestion') {
    const profileId = n.entity_id || n.entityId;
    if (!profileId) return null;
    return {
      kind: 'makker',
      path: `/dashboard/makkere?profile=${encodeURIComponent(String(profileId))}`,
    };
  }
  if (type === 'open_matches_weekly') {
    return { kind: 'kampe-list', path: '/dashboard/kampe' };
  }
  if (isActionableProposalNotification(type)) {
    return {
      kind: 'proposal-popup',
      path: buildProposalFocusPath(proposalIdFromNotification(n)),
    };
  }
  if (isProposalNotification(type)) {
    return { kind: 'home', path: '/dashboard/hjem' };
  }

  const kampeTarget = notificationKampeTarget(n);
  if (kampeTarget) {
    return {
      kind: 'kampe-focus',
      path: buildKampeFocusPath(kampeTarget.format, kampeTarget.focusId, {
        openChat: kampeFocusOpensChat(type),
      }),
    };
  }
  if (type === 'elo_change') {
    return { kind: 'profile', path: '/dashboard/profil' };
  }
  if (type === 'result_submitted') {
    return { kind: 'kampe-list', path: '/dashboard/kampe' };
  }
  if (type === 'growth_campaign_winner') {
    return { kind: 'home', path: '/dashboard/hjem' };
  }
  return null;
}

export function isNotificationClickable(n, { isAdmin = false } = {}) {
  return Boolean(resolveNotificationClickTarget(n, { isAdmin }));
}

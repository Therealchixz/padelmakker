import { useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  ChevronRight,
  MessageCircle,
  Share2,
  UserMinus,
} from 'lucide-react';
import {
  fetchLastMatchMessage,
} from '../../lib/matchChatUtils';
import { formatMatchChatPreview } from '../../lib/matchChatPreview';

export function MatchDetailActionCard({
  matchId,
  currentUserId = null,
  canUseMatchChat = false,
  chatOpen = false,
  onToggleChat,
  unreadChatCount = 0,
  chatMessages = [],
  chatPanel = null,
  joined = false,
  status = null,
  showShare = false,
  onShare,
  onAddToCalendar,
  showLeave = false,
  onLeave,
  leaveLabel = 'Afmeld mig',
  leaveBusy = false,
  extraAction = null,
}) {
  const [fetchedLast, setFetchedLast] = useState(null);
  const liveLast = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
  const liveLastId = liveLast?.id || null;
  const previewMsg = liveLast || fetchedLast;
  const showJoinedBlock = joined && status !== 'completed';
  const showCalendar = showJoinedBlock && typeof onAddToCalendar === 'function';
  const showShareBtn = showJoinedBlock && showShare && typeof onShare === 'function';
  const hasCard =
    canUseMatchChat || showJoinedBlock || showLeave || extraAction;

  useEffect(() => {
    if (!canUseMatchChat || !matchId || liveLastId) {
      if (liveLastId) setFetchedLast(null);
      return undefined;
    }
    let cancelled = false;
    fetchLastMatchMessage(matchId)
      .then((msg) => {
        if (!cancelled) setFetchedLast(msg);
      })
      .catch(() => {
        if (!cancelled) setFetchedLast(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canUseMatchChat, matchId, liveLastId]);

  if (!hasCard) return null;

  return (
    <div className="pm-kd-action-card">
      {canUseMatchChat ? (
        <>
          <button
            type="button"
            className="pm-kd-action-chat"
            onClick={() => onToggleChat?.()}
            aria-expanded={chatOpen}
          >
            <span className="pm-kd-action-chat-ic" aria-hidden>
              <MessageCircle size={18} />
            </span>
            <span className="pm-kd-action-chat-copy">
              <b>Match chat</b>
              <span>{formatMatchChatPreview(previewMsg, currentUserId)}</span>
            </span>
            {unreadChatCount > 0 ? (
              <span className="pm-kd-action-unread" aria-label={`${unreadChatCount} ulæste beskeder`} />
            ) : null}
            <ChevronRight size={18} className="pm-kd-action-chevron" aria-hidden />
          </button>
          {chatOpen && chatPanel ? (
            <div className="pm-kd-action-chat-panel">{chatPanel}</div>
          ) : null}
        </>
      ) : null}

      {showJoinedBlock ? (
        <div className="pm-kd-action-joined">
          <div className="pm-kd-action-joined-status">
            <Check size={16} aria-hidden />
            Du er tilmeldt
          </div>
          {showShareBtn || showCalendar ? (
            <div className="pm-kd-action-joined-btns">
              {showShareBtn ? (
                <button type="button" className="pm-kd-action-btn" onClick={onShare}>
                  <Share2 size={15} aria-hidden />
                  Del kamp
                </button>
              ) : null}
              {showCalendar ? (
                <button type="button" className="pm-kd-action-btn" onClick={onAddToCalendar}>
                  <CalendarPlus size={15} aria-hidden />
                  Tilføj kalender
                </button>
              ) : null}
            </div>
          ) : null}
          {extraAction}
        </div>
      ) : extraAction ? (
        <div className="pm-kd-action-joined">{extraAction}</div>
      ) : null}

      {showLeave ? (
        <button
          type="button"
          className="pm-kd-action-leave"
          onClick={onLeave}
          disabled={leaveBusy}
        >
          <UserMinus size={16} aria-hidden />
          {leaveLabel}
        </button>
      ) : null}
    </div>
  );
}

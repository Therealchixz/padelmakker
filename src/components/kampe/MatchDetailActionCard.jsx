import {
  CalendarPlus,
  Check,
  ChevronRight,
  MessageCircle,
  Share2,
  UserMinus,
} from 'lucide-react';

export function MatchDetailActionCard({
  canUseMatchChat = false,
  chatOpen = false,
  onToggleChat,
  unreadChatCount = 0,
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
  const showJoinedBlock = joined && status !== 'completed';
  const showCalendar = showJoinedBlock && typeof onAddToCalendar === 'function';
  const showShareBtn = showJoinedBlock && showShare && typeof onShare === 'function';
  const hasCard =
    canUseMatchChat || showJoinedBlock || showLeave || extraAction;

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
            aria-label="Match chat"
          >
            <span className="pm-kd-action-chat-ic" aria-hidden>
              <MessageCircle size={18} />
            </span>
            <span className="pm-kd-action-chat-copy">
              <b>Match chat</b>
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

import { SquarePen, Search, X } from 'lucide-react';
import { ChatInitialsAvatar } from './ChatInitialsAvatar';
import { formatInboxTime } from '../../lib/chatDisplayUtils';

export function ChatInbox({
  items = [],
  loading = false,
  error = '',
  searchQuery = '',
  onSearchChange,
  composeOpen = false,
  onToggleCompose,
  composeSlot = null,
  onOpenItem,
  emptySlot = null,
}) {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? items.filter((item) => {
        const hay = `${item.title || ''} ${item.preview || ''}`.toLowerCase();
        return hay.includes(q);
      })
    : items;

  return (
    <div className="pm-chat-v2-inbox">
      <div className="pm-chat-v2-inbox-head">
        <div className="pm-chat-v2-inbox-head-row">
          <h2 className="pm-chat-v2-inbox-title">Beskeder</h2>
          <button
            type="button"
            className={`pm-chat-v2-inbox-compose${composeOpen ? ' pm-chat-v2-inbox-compose--active' : ''}`}
            onClick={onToggleCompose}
            aria-label="Ny besked"
          >
            <SquarePen size={18} aria-hidden />
          </button>
        </div>
        <div className="pm-chat-v2-inbox-search">
          <Search size={16} aria-hidden />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Søg i beskeder…"
          />
          {searchQuery ? (
            <button type="button" className="pm-chat-v2-inbox-search-clear" onClick={() => onSearchChange('')} aria-label="Ryd søgning">
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {composeOpen ? composeSlot : null}

      {loading ? (
        <div className="pm-chat-v2-inbox-status">Indlæser samtaler…</div>
      ) : error ? (
        <div className="pm-chat-v2-inbox-status">{error}</div>
      ) : filtered.length === 0 ? (
        emptySlot || <div className="pm-chat-v2-inbox-status">Ingen samtaler endnu.</div>
      ) : (
        <div className="pm-chat-v2-inbox-list">
          {filtered.map((item) => {
            const unread = Number(item.unread) || 0;
            return (
              <button
                key={item.key}
                type="button"
                className={`pm-chat-v2-inbox-row${unread > 0 ? ' pm-chat-v2-inbox-row--unread' : ''}`}
                onClick={() => onOpenItem(item)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: '#fff', borderRadius: 14, margin: '0 18px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: '1px solid #E2E8F0', width: 'calc(100% - 36px)', textAlign: 'left' }}
              >
                <ChatInitialsAvatar
                  id={item.avatarId || item.key}
                  name={item.title}
                  avatar={item.avatarUrl}
                  size={46}
                  online={item.online}
                />
                <div className="pm-chat-v2-inbox-row-main" style={{ flex: 1, minWidth: 0 }}>
                  <div className="pm-chat-v2-inbox-row-top">
                    <span className="pm-chat-v2-inbox-row-name" style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                    <span className={`pm-chat-v2-inbox-row-time${unread > 0 ? ' pm-chat-v2-inbox-row-time--unread' : ''}`} style={{ fontSize: 10.5 }}>
                      {formatInboxTime(item.time)}
                    </span>
                  </div>
                  <div className="pm-chat-v2-inbox-row-bottom" style={{ marginTop: 3 }}>
                    <span className={`pm-chat-v2-inbox-row-preview${unread > 0 ? ' pm-chat-v2-inbox-row-preview--unread' : ''}`} style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                      {item.preview || 'Ingen beskeder endnu'}
                    </span>
                    {unread > 0 ? (
                      <span className="pm-chat-v2-inbox-unread" style={{ marginTop: 5, marginLeft: 'auto' }}>{unread > 99 ? '99+' : unread}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

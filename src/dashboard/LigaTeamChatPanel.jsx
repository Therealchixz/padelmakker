import { useCallback, useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { btn } from '../lib/platformTheme';
import {
  fetchLeagueTeamMessages,
  formatTeamChatClock,
  sendLeagueTeamMessage,
  subscribeToLeagueTeamMessages,
} from '../lib/leagueTeamChatUtils';

export function LigaTeamChatPanel({
  teamId,
  leagueId,
  teamName = '',
  userId,
  userName = 'Spiller',
  userAvatar = null,
  canWrite = false,
  showToast,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (!teamId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchLeagueTeamMessages(teamId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Kunne ikke hente beskeder.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeToLeagueTeamMessages(teamId, (row) => {
      if (!row?.id) return;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      window.requestAnimationFrame(() => scrollToBottom('smooth'));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [teamId, scrollToBottom]);

  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom('auto');
  }, [loading, messages.length, scrollToBottom]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !canWrite || sending || !teamId || !userId) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await sendLeagueTeamMessage({
        teamId,
        leagueId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        content: text,
      });
      if (msg) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        window.requestAnimationFrame(() => scrollToBottom('smooth'));
      }
    } catch {
      setDraft(text);
      showToast?.('Kunne ikke sende beskeden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pm-match-chat-panel" style={{ marginTop: 4 }}>
      <div className="pm-liga-v2-team-chat-label">
        Beskeder til {teamName || 'holdet'}
      </div>
      <div ref={listRef} className="pm-match-chat-list pm-liga-v2-team-chat-list">
        {loading && <div className="pm-match-chat-empty">Henter beskeder…</div>}
        {!loading && error && <div className="pm-match-chat-empty">{error}</div>}
        {!loading && !error && messages.length === 0 && (
          <div className="pm-match-chat-empty">
            {canWrite
              ? 'Ingen beskeder endnu. Skriv den første til holdet.'
              : 'Ingen beskeder endnu.'}
          </div>
        )}
        {!loading && !error && messages.map((msg) => {
          const mine = String(msg.sender_id) === String(userId);
          const displayName = (msg.sender_name || 'Spiller').trim();
          return (
            <div key={msg.id} className={`pm-match-chat-row ${mine ? 'pm-match-chat-row--mine' : ''}`}>
              <div className={`pm-match-chat-bubble ${mine ? 'pm-match-chat-bubble--mine' : ''}`}>
                <div className="pm-match-chat-meta">
                  <span className="pm-match-chat-author">{mine ? 'Dig' : displayName}</span>
                  <span>{formatTeamChatClock(msg.created_at)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
              </div>
            </div>
          );
        })}
      </div>
      {canWrite ? (
        <div className="pm-match-chat-composer">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Skriv til holdet…"
            className="pm-match-chat-input"
            maxLength={1000}
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => { void handleSend(); }}
            disabled={sending || !draft.trim()}
            style={{
              ...btn(true),
              justifyContent: 'center',
              minWidth: '92px',
              padding: '8px 10px',
              fontSize: '12px',
              opacity: sending || !draft.trim() ? 0.7 : 1,
            }}
          >
            <SendHorizontal size={13} aria-hidden />
            {sending ? 'Sender…' : 'Send'}
          </button>
        </div>
      ) : (
        <p className="pm-liga-v2-team-chat-note">
          Tilmeld et hold i ligaen for at skrive til andre hold.
        </p>
      )}
    </div>
  );
}

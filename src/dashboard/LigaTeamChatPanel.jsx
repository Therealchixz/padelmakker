import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatInputBar } from '../components/chat/ChatInputBar';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import {
  fetchLeagueTeamMessages,
  sendLeagueTeamMessage,
  subscribeToLeagueTeamMessages,
  setLeagueTeamMessageReaction,
} from '../lib/leagueTeamChatUtils';
import { broadcastTeamTyping, subscribeTeamTyping } from '../lib/dmTypingUtils';

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
  const [otherTyping, setOtherTyping] = useState(false);
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

    const unsubscribe = subscribeToLeagueTeamMessages(
      teamId,
      (row) => {
        if (!row?.id) return;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        window.requestAnimationFrame(() => scrollToBottom('smooth'));
      },
      (row) => {
        if (!row?.id) return;
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      }
    );

    const typingUnsub = userId
      ? subscribeTeamTyping(teamId, userId, () => {
          setOtherTyping(true);
          window.setTimeout(() => setOtherTyping(false), 2800);
        })
      : () => {};

    return () => {
      cancelled = true;
      unsubscribe();
      typingUnsub();
      setOtherTyping(false);
    };
  }, [teamId, userId, scrollToBottom]);

  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom('auto');
  }, [loading, messages.length, scrollToBottom]);

  const handleDraftChange = (next) => {
    setDraft(next);
    if (teamId && userId) broadcastTeamTyping(teamId, userId);
  };

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

  const handleReact = async (message, emoji) => {
    const nextReaction = message.reaction === emoji ? '' : emoji;
    try {
      const updated = await setLeagueTeamMessageReaction(message.id, nextReaction);
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      }
    } catch {
      showToast?.('Kunne ikke gemme reaktion.');
    }
  };

  return (
    <div className="pm-liga-v2-team-chat-panel">
      <div className="pm-liga-v2-team-chat-label">
        Beskeder til {teamName || 'holdet'}
      </div>
      <ChatMessageList
        listRef={listRef}
        userId={userId}
        messages={messages}
        loading={loading}
        error={error}
        emptyText={
          canWrite
            ? 'Ingen beskeder endnu. Skriv den første til holdet.'
            : 'Ingen beskeder endnu.'
        }
        groupMode
        showSenderNames
        typingVisible={otherTyping}
        onReact={handleReact}
        className="pm-liga-v2-team-chat-list pm-chat-v2-message-list"
      />
      {canWrite ? (
        <ChatInputBar
          value={draft}
          onChange={handleDraftChange}
          onSend={handleSend}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Skriv til holdet…"
          disabled={false}
          sending={sending}
        />
      ) : (
        <p className="pm-liga-v2-team-chat-note">
          Tilmeld et hold i ligaen for at skrive til andre hold.
        </p>
      )}
    </div>
  );
}

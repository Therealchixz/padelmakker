import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, heading } from '../lib/platformTheme';
import { AvatarCircle } from '../components/AvatarCircle';
import { Send, ArrowLeft, MessageCircle, SquarePen, Search, X } from 'lucide-react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markMessagesRead,
} from '../lib/chatUtils';
import { fetchDmHiddenUserIds, fetchUsersIBlocked } from '../lib/userModeration';
import { BeskedChatActions } from '../components/BeskedChatActions';

const CHAT_WINDOW_SIZE = 80;
const CONVO_CACHE_TTL_MS = 30_000;
const CONVO_CACHE_BY_USER = new Map();
const MESSAGE_CACHE_TTL_MS = 20_000;
const MESSAGE_CACHE_MAX_THREADS = 20;
const MESSAGE_CACHE_BY_THREAD = new Map();

function setMessageThreadCache(threadKey, messages) {
  if (!threadKey) return;
  MESSAGE_CACHE_BY_THREAD.set(threadKey, {
    at: Date.now(),
    ok: true,
    messages: messages || [],
  });
  while (MESSAGE_CACHE_BY_THREAD.size > MESSAGE_CACHE_MAX_THREADS) {
    const oldestKey = MESSAGE_CACHE_BY_THREAD.keys().next().value;
    if (!oldestKey) break;
    MESSAGE_CACHE_BY_THREAD.delete(oldestKey);
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const timeStr = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  if (isYesterday) return `I går ${timeStr}`;
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + timeStr;
}

export function BeskedTab({ user, showToast, onMobileConversationStateChange }) {
  const location = useLocation();
  const navigate = useNavigate();

  const initWithUser = new URLSearchParams(location.search).get('med');

  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedId, setSelectedId] = useState(initWithUser || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [convoLoadError, setConvoLoadError] = useState(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeResults, setComposeResults] = useState([]);
  const [composeSearching, setComposeSearching] = useState(false);
  const [chatVisibleCount, setChatVisibleCount] = useState(CHAT_WINDOW_SIZE);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [mobileChatOffsets, setMobileChatOffsets] = useState({ top: 0 });
  const [dmHiddenIds, setDmHiddenIds] = useState(() => new Set());
  const [blockedByMeIds, setBlockedByMeIds] = useState(() => new Set());
  const bottomRef = useRef(null);
  const messagesPaneRef = useRef(null);
  const inputRef = useRef(null);
  const composeRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const profilesRef = useRef({});
  const profileRequestsRef = useRef(new Set());
  const markReadTimerRef = useRef(null);
  const composeSearchSeqRef = useRef(0);
  const shouldStickToBottomRef = useRef(true);
  const lastScrolledMessageIdRef = useRef(null);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = (event) => setIsMobileView(event.matches);
    setIsMobileView(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  // Hent profil for en enkelt bruger (til ny samtale via ?med=)
  const ensureProfile = useCallback(async (id) => {
    if (!id || profilesRef.current[id] || profileRequestsRef.current.has(id)) return;
    profileRequestsRef.current.add(id);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar')
        .eq('id', id)
        .maybeSingle();
      if (data) setProfiles(prev => ({ ...prev, [data.id]: data }));
    } finally {
      profileRequestsRef.current.delete(id);
    }
  }, []);

  const scheduleMarkRead = useCallback((otherId, delay = 180) => {
    if (!otherId || !user?.id) return;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      void markMessagesRead(user.id, otherId);
    }, delay);
  }, [user?.id]);

  const updateStickToBottom = useCallback(() => {
    const pane = messagesPaneRef.current;
    if (!pane) return;
    const distanceFromBottom = pane.scrollHeight - (pane.scrollTop + pane.clientHeight);
    shouldStickToBottomRef.current = distanceFromBottom < 96;
  }, []);

  const clearConversationUnread = useCallback((otherId) => {
    setConversations(prev => prev.map((c) => (
      c.otherId === otherId && c.unread
        ? { ...c, unread: 0 }
        : c
    )));
  }, []);

  const upsertConversationFromMessage = useCallback((msg, { incomingRead = false } = {}) => {
    if (!msg || !user?.id) return;
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (!otherId) return;
    ensureProfile(otherId);
    setConversations(prev => {
      const idx = prev.findIndex(c => c.otherId === otherId);
      const existing = idx >= 0 ? prev[idx] : null;
      const prevLastMs = existing?.lastMessage?.created_at ? new Date(existing.lastMessage.created_at).getTime() : 0;
      const nextLastMs = msg.created_at ? new Date(msg.created_at).getTime() : 0;
      const lastMessage = nextLastMs >= prevLastMs ? msg : existing?.lastMessage || msg;
      const isIncomingUnread = msg.receiver_id === user.id && msg.is_read === false;
      const unread = incomingRead ? 0 : (existing?.unread || 0) + (isIncomingUnread ? 1 : 0);
      const nextConversation = { otherId, lastMessage, unread };
      const next = idx >= 0
        ? prev.map((c, i) => (i === idx ? nextConversation : c))
        : [nextConversation, ...prev];
      return next.sort(
        (a, b) => new Date(b.lastMessage?.created_at || 0).getTime() - new Date(a.lastMessage?.created_at || 0).getTime()
      );
    });
  }, [ensureProfile, user?.id]);

  const refreshBlockState = useCallback(async () => {
    if (!user?.id) {
      setDmHiddenIds(new Set());
      setBlockedByMeIds(new Set());
      return;
    }
    try {
      const [hidden, mine] = await Promise.all([
        fetchDmHiddenUserIds(user.id),
        fetchUsersIBlocked(user.id),
      ]);
      setDmHiddenIds(hidden);
      setBlockedByMeIds(mine);
    } catch {
      setDmHiddenIds(new Set());
      setBlockedByMeIds(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshBlockState();
  }, [refreshBlockState]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    const cacheKey = String(user.id);
    const cached = CONVO_CACHE_BY_USER.get(cacheKey);
    if (cached?.ok) {
      setConversations(cached.conversations);
      if (cached.profiles && Object.keys(cached.profiles).length > 0) {
        setProfiles(prev => ({ ...cached.profiles, ...prev }));
      }
      setLoadingConvos(false);
      if (Date.now() - cached.at < CONVO_CACHE_TTL_MS) return;
    }
    setConvoLoadError(null);
    try {
      const convos = await fetchConversations(user.id);
      setConversations(convos);

      const otherIds = convos.map(c => c.otherId);
      if (initWithUser && !otherIds.includes(initWithUser)) otherIds.push(initWithUser);

      const missingIds = otherIds.filter((id) => !profilesRef.current[id] && !profileRequestsRef.current.has(id));
      if (missingIds.length > 0) {
        missingIds.forEach((id) => profileRequestsRef.current.add(id));
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, name, avatar')
            .in('id', missingIds);
          const map = {};
          for (const p of data || []) map[p.id] = p;
          if (Object.keys(map).length > 0) {
            setProfiles(prev => ({ ...prev, ...map }));
          }
        } finally {
          missingIds.forEach((id) => profileRequestsRef.current.delete(id));
        }
      }
      CONVO_CACHE_BY_USER.set(cacheKey, {
        at: Date.now(),
        ok: true,
        conversations: convos,
        profiles: profilesRef.current,
      });
    } catch (e) {
      console.warn('load conversations:', e);
      const msg = 'Kunne ikke hente samtaler. Tjek din forbindelse og prøv igen.';
      setConvoLoadError(msg);
      showToast?.(msg);
    } finally {
      setLoadingConvos(false);
    }
  }, [user?.id, initWithUser, showToast]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Sikrer profil til ny samtale via URL param
  useEffect(() => {
    if (initWithUser) ensureProfile(initWithUser);
  }, [initWithUser, ensureProfile]);

  // Indlæs beskeder + real-time subscription når samtale vælges
  useEffect(() => {
    if (!selectedId || !user?.id) {
      setMessages([]);
      setMessageLoadError(null);
      return;
    }
    const threadKey = `${user.id}:${selectedId}`;
    const cachedThread = MESSAGE_CACHE_BY_THREAD.get(threadKey);
    const hasCachedThread = cachedThread?.ok === true;
    const isCacheFresh = hasCachedThread && (Date.now() - cachedThread.at < MESSAGE_CACHE_TTL_MS);

    if (hasCachedThread) {
      setMessages(cachedThread.messages || []);
      setLoadingMsgs(false);
      scheduleMarkRead(selectedId, 60);
      clearConversationUnread(selectedId);
    } else {
      setLoadingMsgs(true);
    }

    if (!isCacheFresh) {
      setLoadingMsgs(true);
      setMessageLoadError(null);
      fetchMessages(user.id, selectedId)
        .then(msgs => {
          setMessages(msgs);
          setMessageThreadCache(threadKey, msgs);
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg) upsertConversationFromMessage(lastMsg, { incomingRead: true });
          scheduleMarkRead(selectedId, 60);
          clearConversationUnread(selectedId);
        })
        .catch((e) => {
          console.warn('load messages:', e);
          const msg = 'Kunne ikke hente beskeder. Prøv igen.';
          setMessageLoadError(msg);
          showToast?.(msg);
        })
        .finally(() => setLoadingMsgs(false));
    }

    const handleIncomingMessage = (payload) => {
      const msg = payload.new;
      const relevant =
        (msg.sender_id === user.id && msg.receiver_id === selectedId) ||
        (msg.sender_id === selectedId && msg.receiver_id === user.id);
      if (!relevant) return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      upsertConversationFromMessage(msg, { incomingRead: msg.receiver_id === user.id });
      if (msg.receiver_id === user.id) {
        scheduleMarkRead(selectedId, 120);
        clearConversationUnread(selectedId);
      }
    };

    const incomingChannel = supabase
      .channel(`chat-in-${user.id}-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        handleIncomingMessage
      )
      .subscribe();

    const outgoingChannel = supabase
      .channel(`chat-out-${user.id}-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        handleIncomingMessage
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
      supabase.removeChannel(outgoingChannel);
    };
  }, [clearConversationUnread, scheduleMarkRead, selectedId, upsertConversationFromMessage, user?.id]);

  useEffect(() => {
    setChatVisibleCount(CHAT_WINDOW_SIZE);
    prevMessageCountRef.current = 0;
    shouldStickToBottomRef.current = true;
    lastScrolledMessageIdRef.current = null;
  }, [selectedId]);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    if (messages.length > prevCount && prevCount > 0 && chatVisibleCount >= prevCount) {
      setChatVisibleCount(messages.length);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, chatVisibleCount]);

  // Scroll til bund ved nye beskeder når bruger allerede er tæt på bunden
  useEffect(() => {
    const lastMessageId = messages[messages.length - 1]?.id;
    if (!lastMessageId || lastScrolledMessageIdRef.current === lastMessageId) return;
    if (!shouldStickToBottomRef.current && messages.length > 1) return;
    bottomRef.current?.scrollIntoView({ behavior: messages.length <= 15 ? 'auto' : 'smooth' });
    lastScrolledMessageIdRef.current = lastMessageId;
  }, [messages]);

  useEffect(() => {
    if (!selectedId || !user?.id) return;
    setMessageThreadCache(`${user.id}:${selectedId}`, messages);
  }, [messages, selectedId, user?.id]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setInputText('');
    try {
      const msg = await sendMessage(user.id, selectedId, text);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      upsertConversationFromMessage(msg);
    } catch (e) {
      setInputText(text);
      const errMsg = String(e?.message || '');
      if (errMsg.toLowerCase().includes('bloker')) {
        void refreshBlockState();
        showToast?.('Du kan ikke sende beskeder til denne bruger.');
      } else {
        const msg = 'Kunne ikke sende besked. Prøv igen.';
        showToast?.(msg);
      }
    } finally {
      setSending(false);
      if (isMobileView) {
        inputRef.current?.blur();
      } else {
        inputRef.current?.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openConversation = (otherId) => {
    setSelectedId(otherId);
    navigate('/dashboard/beskeder', { replace: true });
    ensureProfile(otherId);
    setComposeOpen(false);
    setComposeQuery('');
    setComposeResults([]);
  };

  const updateMobileChatOffsets = useCallback(() => {
    if (typeof window === 'undefined') return;
    const headerEl = document.querySelector('.pm-dash-header');
    const top = headerEl ? Math.max(0, Math.round(headerEl.getBoundingClientRect().bottom)) : 0;
    setMobileChatOffsets((prev) => {
      if (prev.top === top) return prev;
      return { top };
    });
  }, []);

  const mobileChatActive = Boolean(selectedId && isMobileView);

  useEffect(() => {
    if (!mobileChatActive || typeof window === 'undefined') return undefined;
    const handleViewportResize = () => updateMobileChatOffsets();
    updateMobileChatOffsets();
    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => {
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [mobileChatActive, updateMobileChatOffsets]);

  useEffect(() => {
    if (!onMobileConversationStateChange) return undefined;
    onMobileConversationStateChange(mobileChatActive);
    return () => onMobileConversationStateChange(false);
  }, [mobileChatActive, onMobileConversationStateChange]);

  // Debounced søgning efter brugere til ny besked
  useEffect(() => {
    if (!composeOpen) {
      setComposeSearching(false);
      return;
    }
    const q = composeQuery.trim();
    if (!q || q.length < 2) {
      setComposeSearching(false);
      setComposeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const requestId = ++composeSearchSeqRef.current;
      setComposeSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, name, avatar')
          .or(`full_name.ilike.%${q}%,name.ilike.%${q}%`)
          .neq('id', user.id)
          .limit(8);
        if (requestId === composeSearchSeqRef.current) {
          const rows = (data || []).filter((p) => !dmHiddenIds.has(String(p.id)));
          setComposeResults(rows);
        }
      } finally {
        if (requestId === composeSearchSeqRef.current) {
          setComposeSearching(false);
        }
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      composeSearchSeqRef.current += 1;
    };
  }, [composeQuery, composeOpen, user.id, dmHiddenIds]);

  // Fokusér søgefeltet når compose åbner
  useEffect(() => {
    if (composeOpen) setTimeout(() => composeRef.current?.focus(), 50);
  }, [composeOpen]);

  useEffect(() => {
    if (!user?.id || loadingConvos) return;
    CONVO_CACHE_BY_USER.set(String(user.id), {
      at: Date.now(),
      ok: true,
      conversations,
      profiles,
    });
  }, [conversations, loadingConvos, profiles, user?.id]);

  const getName = (id) => {
    const p = profiles[id];
    return p?.full_name || p?.name || 'Spiller';
  };

  // ── Beskedvisning ──────────────────────────────────────────────────────────
  if (selectedId) {
    const otherProfile = profiles[selectedId];
    const chatIsBlocked = dmHiddenIds.has(String(selectedId));
    const iBlockedThem = blockedByMeIds.has(String(selectedId));
    const hiddenMessageCount = Math.max(0, messages.length - chatVisibleCount);
    const visibleMessages = hiddenMessageCount > 0 ? messages.slice(-chatVisibleCount) : messages;
    return (
      <div
        className={mobileChatActive ? 'pm-besked-chat-shell pm-besked-chat-shell--mobile' : 'pm-besked-chat-shell'}
        style={mobileChatActive ? { top: `${mobileChatOffsets.top || 64}px` } : undefined}
      >
        <div className="pm-besked-chat-topbar">
          <button
            onClick={() => { setSelectedId(null); navigate('/dashboard/beskeder', { replace: true }); }}
            style={{ ...btn(false), padding: '6px 10px', fontSize: '13px' }}
          >
            <ArrowLeft size={14} />
          </button>
          {otherProfile && (
            <AvatarCircle
              avatar={otherProfile.avatar} size={34} emojiSize="15px"
              style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }}
            />
          )}
          <span className="pm-besked-chat-topbar-title">{getName(selectedId)}</span>
          <BeskedChatActions
            otherUserId={selectedId}
            otherName={getName(selectedId)}
            iBlockedThem={iBlockedThem}
            onBlocked={async () => {
              await refreshBlockState();
              setSelectedId(null);
              navigate('/dashboard/beskeder', { replace: true });
              void loadConversations();
            }}
            onUnblocked={async () => {
              await refreshBlockState();
              void loadConversations();
            }}
          />
        </div>

        {chatIsBlocked && (
          <div className="pm-besked-chat-blocked">
            {iBlockedThem
              ? `Du har blokeret ${getName(selectedId)}. Fjern blokeringen via ⋮ for at skrive igen.`
              : `Du kan ikke sende beskeder til ${getName(selectedId)} i denne samtale.`}
          </div>
        )}

        <div
          className="pm-besked-messages-pane"
          ref={messagesPaneRef}
          onScroll={updateStickToBottom}
        >
          {loadingMsgs && (
            <div className="pm-besked-messages-status">Indlæser beskeder…</div>
          )}
          {!loadingMsgs && messageLoadError && (
            <div className="pm-state-card pm-state-card--error" style={{ margin: '8px 0' }}>
              <div className="pm-state-title">Kunne ikke hente beskeder</div>
              <div className="pm-state-copy">{messageLoadError}</div>
              <div className="pm-state-actions">
                <button
                  type="button"
                  onClick={() => {
                    setMessageLoadError(null);
                    setLoadingMsgs(true);
                    fetchMessages(user.id, selectedId)
                      .then((msgs) => {
                        setMessages(msgs);
                        setMessageThreadCache(`${user.id}:${selectedId}`, msgs);
                      })
                      .catch(() => {
                        const msg = 'Kunne ikke hente beskeder. Prøv igen.';
                        setMessageLoadError(msg);
                        showToast?.(msg);
                      })
                      .finally(() => setLoadingMsgs(false));
                  }}
                  style={{ ...btn(true), fontSize: '13px' }}
                >
                  Prøv igen
                </button>
              </div>
            </div>
          )}
          {!loadingMsgs && !messageLoadError && messages.length === 0 && (
            <div className="pm-besked-messages-empty">
              Start samtalen med {getName(selectedId)}
            </div>
          )}
          {hiddenMessageCount > 0 && (
            <div className="pm-besked-load-older">
              <button
                type="button"
                className="pm-ui-btn-chip"
                onClick={() => setChatVisibleCount((prev) => Math.min(messages.length, prev + CHAT_WINDOW_SIZE))}
              >
                Vis {Math.min(CHAT_WINDOW_SIZE, hiddenMessageCount)} tidligere beskeder
              </button>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div
                key={msg.id}
                className={isMe ? 'pm-besked-bubble-row pm-besked-bubble-row--me' : 'pm-besked-bubble-row pm-besked-bubble-row--them'}
              >
                <div className={isMe ? 'pm-besked-bubble pm-besked-bubble--me' : 'pm-besked-bubble pm-besked-bubble--them'}>
                  <div>{msg.content}</div>
                  <div className={isMe ? 'pm-besked-bubble-time pm-besked-bubble-time--me' : 'pm-besked-bubble-time pm-besked-bubble-time--them'}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="pm-besked-input-bar">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatIsBlocked ? 'Beskeder er blokeret' : 'Skriv en besked...'}
            rows={1}
            disabled={chatIsBlocked}
            style={inputStyle}
          />
          <button
            onClick={handleSend}
            disabled={chatIsBlocked || !inputText.trim() || sending}
            style={{
              ...btn(true), padding: '10px 14px', flexShrink: 0,
              opacity: !inputText.trim() || sending ? 0.45 : 1,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Samtaleliste ──────────────────────────────────────────────────────────
  return (
    <div className="pm-besked-page">
      <div className="pm-besked-page-header">
        <h2 style={{ ...heading('clamp(20px,4.5vw,24px)') }}>Beskeder</h2>
        <button
          type="button"
          onClick={() => setComposeOpen(o => !o)}
          style={{ ...btn(composeOpen), padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <SquarePen size={14} /> Ny besked
        </button>
      </div>

      {composeOpen && (
        <div className="pm-ui-card pm-besked-compose">
          <div className="pm-besked-compose-search">
            <Search size={15} color={theme.textLight} style={{ flexShrink: 0 }} />
            <input
              ref={composeRef}
              value={composeQuery}
              onChange={e => setComposeQuery(e.target.value)}
              placeholder="Søg efter spiller..."
            />
            {composeQuery && (
              <button
                type="button"
                className="pm-besked-compose-search-clear"
                onClick={() => { setComposeQuery(''); setComposeResults([]); }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {composeSearching && (
            <div className="pm-besked-compose-hint">Søger…</div>
          )}
          {!composeSearching && composeQuery && composeResults.length === 0 && (
            <div className="pm-besked-compose-hint">Ingen spillere fundet.</div>
          )}
          {!composeSearching && !composeQuery && (
            <div className="pm-besked-compose-hint">Skriv et navn for at søge.</div>
          )}
          {composeResults.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              className="pm-besked-compose-row"
              onClick={() => openConversation(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openConversation(p.id);
                }
              }}
            >
              <AvatarCircle avatar={p.avatar} size={38} emojiSize="18px" style={{ background: theme.accentBg, border: `1px solid ${theme.border}`, flexShrink: 0 }} />
              <span className="pm-besked-compose-row-name">{p.full_name || p.name || 'Spiller'}</span>
            </div>
          ))}
        </div>
      )}

      {loadingConvos ? (
        <div className="pm-state-card pm-state-card--loading">
          <div className="pm-spinner pm-state-spinner" />
          <div className="pm-state-title">Indlæser samtaler…</div>
        </div>
      ) : convoLoadError ? (
        <div className="pm-state-card pm-state-card--error">
          <div className="pm-state-icon" aria-hidden="true">⚠️</div>
          <div className="pm-state-title">Kunne ikke hente samtaler</div>
          <div className="pm-state-copy">{convoLoadError}</div>
          <div className="pm-state-actions">
            <button type="button" onClick={() => void loadConversations()} style={{ ...btn(true), fontSize: '13px' }}>
              Prøv igen
            </button>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty">
          <MessageCircle size={48} color={theme.border} style={{ marginBottom: '14px' }} aria-hidden />
          <div className="pm-state-title">Ingen samtaler endnu</div>
          <div className="pm-state-copy">
            Tryk <strong>Ny besked</strong> for at starte en samtale.
          </div>
        </div>
      ) : (
        <div className="pm-ui-card pm-besked-convo-list">
          {conversations.map((convo) => {
            const p = profiles[convo.otherId];
            const isFromMe = convo.lastMessage.sender_id === user.id;
            const hasUnread = convo.unread > 0;
            return (
              <div
                key={convo.otherId}
                role="button"
                tabIndex={0}
                className={hasUnread ? 'pm-besked-convo-row pm-besked-convo-row--unread' : 'pm-besked-convo-row'}
                onClick={() => openConversation(convo.otherId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openConversation(convo.otherId);
                  }
                }}
              >
                <div className="pm-besked-convo-avatar-wrap">
                  <AvatarCircle
                    avatar={p?.avatar}
                    size={46}
                    emojiSize="21px"
                    style={{ background: theme.accentBg, border: `1px solid ${theme.border}` }}
                  />
                  {hasUnread && (
                    <span className="pm-besked-unread-badge">{convo.unread}</span>
                  )}
                </div>
                <div className="pm-besked-convo-meta">
                  <div className="pm-besked-convo-topline">
                    <span className={hasUnread ? 'pm-besked-convo-name pm-besked-convo-name--unread' : 'pm-besked-convo-name pm-besked-convo-name--read'}>
                      {p?.full_name || p?.name || 'Spiller'}
                    </span>
                    <span className="pm-besked-convo-time">
                      {formatTime(convo.lastMessage.created_at)}
                    </span>
                  </div>
                  <div className={hasUnread ? 'pm-besked-convo-preview pm-besked-convo-preview--unread' : 'pm-besked-convo-preview pm-besked-convo-preview--read'}>
                    {isFromMe ? 'Dig: ' : ''}{convo.lastMessage.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

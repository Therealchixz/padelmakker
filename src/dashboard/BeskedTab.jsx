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

const CHAT_WINDOW_SIZE = 80;

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

export function BeskedTab({ user, onMobileConversationStateChange }) {
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
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeResults, setComposeResults] = useState([]);
  const [composeSearching, setComposeSearching] = useState(false);
  const [chatVisibleCount, setChatVisibleCount] = useState(CHAT_WINDOW_SIZE);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [mobileChatOffsets, setMobileChatOffsets] = useState({ top: 0 });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const composeRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const profilesRef = useRef({});
  const profileRequestsRef = useRef(new Set());

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

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

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
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
    } finally {
      setLoadingConvos(false);
    }
  }, [user?.id, initWithUser]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Sikrer profil til ny samtale via URL param
  useEffect(() => {
    if (initWithUser) ensureProfile(initWithUser);
  }, [initWithUser, ensureProfile]);

  // Indlæs beskeder + real-time subscription når samtale vælges
  useEffect(() => {
    if (!selectedId || !user?.id) { setMessages([]); return; }

    setLoadingMsgs(true);
    fetchMessages(user.id, selectedId)
      .then(msgs => {
        setMessages(msgs);
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) upsertConversationFromMessage(lastMsg, { incomingRead: true });
        void markMessagesRead(user.id, selectedId);
        clearConversationUnread(selectedId);
      })
      .finally(() => setLoadingMsgs(false));

    const channel = supabase
      .channel(`chat-${[user.id, selectedId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
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
            void markMessagesRead(user.id, selectedId);
            clearConversationUnread(selectedId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clearConversationUnread, selectedId, upsertConversationFromMessage, user?.id]);

  useEffect(() => {
    setChatVisibleCount(CHAT_WINDOW_SIZE);
    prevMessageCountRef.current = 0;
  }, [selectedId]);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    if (messages.length > prevCount && prevCount > 0 && chatVisibleCount >= prevCount) {
      setChatVisibleCount(messages.length);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, chatVisibleCount]);

  // Scroll til bund ved nye beskeder
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setInputText('');
    try {
      const msg = await sendMessage(user.id, selectedId, text);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      upsertConversationFromMessage(msg);
    } catch {
      setInputText(text);
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
    if (!composeOpen) return;
    if (!composeQuery.trim()) { setComposeResults([]); return; }
    const timer = setTimeout(async () => {
      setComposeSearching(true);
      try {
        const q = composeQuery.trim();
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, name, avatar')
          .or(`full_name.ilike.%${q}%,name.ilike.%${q}%`)
          .neq('id', user.id)
          .limit(8);
        setComposeResults(data || []);
      } finally {
        setComposeSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [composeQuery, composeOpen, user.id]);

  // Fokusér søgefeltet når compose åbner
  useEffect(() => {
    if (composeOpen) setTimeout(() => composeRef.current?.focus(), 50);
  }, [composeOpen]);

  const getName = (id) => {
    const p = profiles[id];
    return p?.full_name || p?.name || 'Spiller';
  };

  // ── Beskedvisning ──────────────────────────────────────────────────────────
  if (selectedId) {
    const otherProfile = profiles[selectedId];
    const hiddenMessageCount = Math.max(0, messages.length - chatVisibleCount);
    const visibleMessages = hiddenMessageCount > 0 ? messages.slice(-chatVisibleCount) : messages;
    const chatShellStyle = mobileChatActive
      ? {
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          right: 0,
          top: `${mobileChatOffsets.top || 64}px`,
          bottom: '0px',
          height: 'auto',
          maxHeight: 'none',
          background: theme.bg,
          zIndex: 30,
        }
      : {
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 130px)',
          maxHeight: '720px',
        };
    return (
      <div style={chatShellStyle}>
        {/* Topbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderBottom: '1px solid ' + theme.border,
          background: theme.surface, flexShrink: 0,
        }}>
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
          <span style={{ fontWeight: 700, fontSize: '15px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getName(selectedId)}
          </span>
        </div>

        {/* Beskeder */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
          display: 'flex', flexDirection: 'column', gap: '6px',
          background: theme.bg,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}>
          {loadingMsgs && (
            <div style={{ textAlign: 'center', color: theme.textLight, fontSize: '13px', padding: '20px' }}>
              Indlæser…
            </div>
          )}
          {!loadingMsgs && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: theme.textLight, fontSize: '13px', marginTop: '28px', lineHeight: 1.6 }}>
              Start samtalen med {getName(selectedId)}
            </div>
          )}
          {hiddenMessageCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
              <button
                type="button"
                onClick={() => setChatVisibleCount((prev) => Math.min(messages.length, prev + CHAT_WINDOW_SIZE))}
                style={{
                  ...btn(false),
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                }}
              >
                Vis {Math.min(CHAT_WINDOW_SIZE, hiddenMessageCount)} tidligere beskeder
              </button>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '76%',
                  background: isMe ? theme.accent : theme.surfaceAlt,
                  color: isMe ? '#fff' : theme.text,
                  borderRadius: isMe ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  padding: '9px 13px',
                  fontSize: '14px',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                  border: isMe ? 'none' : '1px solid ' + theme.border,
                  boxShadow: isMe ? 'none' : '0 1px 2px rgba(0,0,0,0.07)',
                }}>
                  <div>{msg.content}</div>
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          display: 'flex', gap: '8px', padding: '10px 12px',
          borderTop: '1px solid ' + theme.border,
          background: theme.surface, flexShrink: 0,
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en besked..."
            rows={1}
            style={{
              ...inputStyle, flex: 1, resize: 'none',
              padding: '10px 12px', fontSize: isMobileView ? '16px' : '14px', lineHeight: 1.4,
              maxHeight: '100px', overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ ...heading('clamp(20px,4.5vw,24px)') }}>Beskeder</h2>
        <button
          onClick={() => setComposeOpen(o => !o)}
          style={{ ...btn(composeOpen), padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <SquarePen size={14} /> Ny besked
        </button>
      </div>

      {/* Compose-panel */}
      {composeOpen && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, border: '1px solid ' + theme.border, boxShadow: theme.shadow, marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid ' + theme.border }}>
            <Search size={15} color={theme.textLight} style={{ flexShrink: 0 }} />
            <input
              ref={composeRef}
              value={composeQuery}
              onChange={e => setComposeQuery(e.target.value)}
              placeholder="Søg efter spiller..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', background: 'transparent', fontFamily: 'inherit', color: theme.text }}
            />
            {composeQuery && (
              <button onClick={() => { setComposeQuery(''); setComposeResults([]); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: theme.textLight, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
          {composeSearching && (
            <div style={{ padding: '14px 16px', fontSize: '13px', color: theme.textLight }}>Søger…</div>
          )}
          {!composeSearching && composeQuery && composeResults.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: '13px', color: theme.textLight }}>Ingen spillere fundet.</div>
          )}
          {!composeSearching && !composeQuery && (
            <div style={{ padding: '14px 16px', fontSize: '13px', color: theme.textLight }}>Skriv et navn for at søge.</div>
          )}
          {composeResults.map((p, idx) => (
            <div
              key={p.id}
              onClick={() => openConversation(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', cursor: 'pointer',
                borderTop: idx > 0 ? '1px solid ' + theme.border : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = theme.accentBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <AvatarCircle avatar={p.avatar} size={38} emojiSize="18px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{p.full_name || p.name || 'Spiller'}</span>
            </div>
          ))}
        </div>
      )}

      {loadingConvos ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.textLight, fontSize: '14px' }}>
          Indlæser samtaler…
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: theme.textLight }}>
          <MessageCircle size={48} color={theme.border} style={{ marginBottom: '14px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: theme.text, marginBottom: '6px' }}>
            Ingen samtaler endnu
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            Tryk <strong>Ny besked</strong> for at starte en samtale.
          </div>
        </div>
      ) : (
        <div style={{ borderRadius: theme.radius, overflow: 'hidden', border: '1px solid ' + theme.border, background: theme.surface, boxShadow: theme.shadow }}>
          {conversations.map((convo, idx) => {
            const p = profiles[convo.otherId];
            const isFromMe = convo.lastMessage.sender_id === user.id;
            const hasUnread = convo.unread > 0;
            return (
              <div
                key={convo.otherId}
                onClick={() => openConversation(convo.otherId)}
                style={{
                  display: 'flex', gap: '12px', alignItems: 'center',
                  padding: '14px 16px', cursor: 'pointer',
                  borderTop: idx > 0 ? '1px solid ' + theme.border : 'none',
                  background: hasUnread ? '#EFF6FF' : theme.surface,
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <AvatarCircle
                    avatar={p?.avatar} size={46} emojiSize="21px"
                    style={{ background: theme.accentBg, border: '1px solid ' + theme.border }}
                  />
                  {hasUnread && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2,
                      background: theme.accent, color: '#fff',
                      borderRadius: '10px', fontSize: '9px', fontWeight: 800,
                      padding: '1px 5px', border: '2px solid ' + theme.surface,
                    }}>
                      {convo.unread}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', gap: '8px' }}>
                    <span style={{ fontWeight: hasUnread ? 800 : 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p?.full_name || p?.name || 'Spiller'}
                    </span>
                    <span style={{ fontSize: '11px', color: theme.textLight, flexShrink: 0 }}>
                      {formatTime(convo.lastMessage.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '13px', color: hasUnread ? theme.textMid : theme.textLight,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: hasUnread ? 600 : 400,
                  }}>
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

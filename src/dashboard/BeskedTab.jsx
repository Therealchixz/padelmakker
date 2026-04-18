import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, heading } from '../lib/platformTheme';
import { AvatarCircle } from '../components/AvatarCircle';
import { Send, ArrowLeft, MessageCircle } from 'lucide-react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markMessagesRead,
} from '../lib/chatUtils';

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

export function BeskedTab({ user }) {
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
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Hent profil for en enkelt bruger (til ny samtale via ?med=)
  const ensureProfile = useCallback(async (id) => {
    if (!id || profiles[id]) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, name, avatar')
      .eq('id', id)
      .maybeSingle();
    if (data) setProfiles(prev => ({ ...prev, [data.id]: data }));
  }, [profiles]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const convos = await fetchConversations(user.id);
      setConversations(convos);

      const otherIds = convos.map(c => c.otherId);
      if (initWithUser && !otherIds.includes(initWithUser)) otherIds.push(initWithUser);

      if (otherIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, name, avatar')
          .in('id', otherIds);
        const map = {};
        for (const p of data || []) map[p.id] = p;
        setProfiles(map);
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
        markMessagesRead(user.id, selectedId);
        loadConversations();
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
          if (msg.receiver_id === user.id) {
            markMessagesRead(user.id, selectedId);
            loadConversations();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user?.id]);

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
      loadConversations();
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openConversation = (otherId) => {
    setSelectedId(otherId);
    navigate('/dashboard/beskeder', { replace: true });
    ensureProfile(otherId);
  };

  const getName = (id) => {
    const p = profiles[id];
    return p?.full_name || p?.name || 'Spiller';
  };

  // ── Beskedvisning ──────────────────────────────────────────────────────────
  if (selectedId) {
    const otherProfile = profiles[selectedId];
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 130px)', maxHeight: '720px',
      }}>
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
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '76%',
                  background: isMe ? theme.accent : '#fff',
                  color: isMe ? '#fff' : theme.text,
                  borderRadius: isMe ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  padding: '9px 13px',
                  fontSize: '14px',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                  border: isMe ? 'none' : '1px solid #E2E8F0',
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
              padding: '10px 12px', fontSize: '14px', lineHeight: 1.4,
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
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '16px' }}>Beskeder</h2>

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
            Find en spiller under <strong>Find Makker</strong> og tryk <strong>Besked</strong>.
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
                      padding: '1px 5px', border: '2px solid #fff',
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

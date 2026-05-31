import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { theme, btn } from '../lib/platformTheme';
import { AvatarCircle } from '../components/AvatarCircle';
import { MessageCircle, Search, X } from 'lucide-react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markMessagesRead,
  setDmMessageReaction,
  fetchChatPartnerProfile,
} from '../lib/chatUtils';
import {
  fetchLeagueTeamConversations,
  fetchLeagueTeamMessages,
  fetchLeagueTeamMeta,
  sendLeagueTeamMessage,
  subscribeToLeagueTeamMessages,
  setLeagueTeamMessageReaction,
} from '../lib/leagueTeamChatUtils';
import { fetchInvitableMatches, buildInvitePayloadForMatch, joinMatchFromChatInvite, fetchShareableCourts } from '../lib/chatInviteUtils';
import { CHAT_MESSAGE_TYPES, buildTimeSuggestionPayload, buildVenueSharePayload, messagePreview } from '../lib/chatMessageUtils';
import { isUserOnline, onlineStatusLabel } from '../lib/chatPresenceUtils';
import { broadcastDmTyping, subscribeDmTyping, broadcastTeamTyping, subscribeTeamTyping } from '../lib/dmTypingUtils';
import { ChatActionSheet } from '../components/chat/ChatActionSheet';
import { fetchDmHiddenUserIds, fetchUsersIBlocked } from '../lib/userModeration';
import { BeskedChatActions } from '../components/BeskedChatActions';
import { ChatInbox } from '../components/chat/ChatInbox';
import { ChatThreadHeader } from '../components/chat/ChatThreadHeader';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { ChatInputBar } from '../components/chat/ChatInputBar';

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

export function BeskedTab({ user, showToast, setTab, onMobileConversationStateChange }) {
  const location = useLocation();
  const navigate = useNavigate();

  const initWithUser = new URLSearchParams(location.search).get('med');
  const initWithTeam = new URLSearchParams(location.search).get('hold');

  const [conversations, setConversations] = useState([]);
  const [teamConversations, setTeamConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedId, setSelectedId] = useState(initWithTeam ? null : (initWithUser || null));
  const [selectedTeamId, setSelectedTeamId] = useState(initWithTeam || null);
  const [teamMeta, setTeamMeta] = useState(null);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState(null);
  const [teamSending, setTeamSending] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [actionSheet, setActionSheet] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [invitableMatches, setInvitableMatches] = useState([]);
  const [shareableCourts, setShareableCourts] = useState([]);
  const [timeDraft, setTimeDraft] = useState({ date: '', time: '18:00' });
  const [joiningInviteId, setJoiningInviteId] = useState(null);
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
  const [mobileChatViewport, setMobileChatViewport] = useState(null);
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
        .select('id, full_name, name, avatar, elo_rating, level, last_active_at')
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
      const [convos, teamConvos] = await Promise.all([
        fetchConversations(user.id),
        fetchLeagueTeamConversations(user.id).catch(() => []),
      ]);
      setConversations(convos);
      setTeamConversations(teamConvos);

      const otherIds = convos.map(c => c.otherId);
      if (initWithUser && !otherIds.includes(initWithUser)) otherIds.push(initWithUser);

      const missingIds = otherIds.filter((id) => !profilesRef.current[id] && !profileRequestsRef.current.has(id));
      if (missingIds.length > 0) {
        missingIds.forEach((id) => profileRequestsRef.current.add(id));
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, name, avatar, last_active_at, elo_rating, level')
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

  useEffect(() => {
    if (!initWithTeam) return;
    fetchLeagueTeamMeta(initWithTeam)
      .then((meta) => { if (meta) setTeamMeta(meta); })
      .catch(() => {});
  }, [initWithTeam]);

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

    const handleMessageUpdate = (payload) => {
      const msg = payload.new;
      const relevant =
        (msg.sender_id === user.id && msg.receiver_id === selectedId) ||
        (msg.sender_id === selectedId && msg.receiver_id === user.id);
      if (!relevant) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    };

    const updateChannel = supabase
      .channel(`chat-up-${user.id}-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        handleMessageUpdate
      )
      .subscribe();

    fetchChatPartnerProfile(selectedId)
      .then((p) => { if (p) { setPartnerProfile(p); setProfiles((prev) => ({ ...prev, [p.id]: p })); } })
      .catch(() => {});

    const typingUnsub = subscribeDmTyping(user.id, selectedId, () => {
      setOtherTyping(true);
      window.setTimeout(() => setOtherTyping(false), 2800);
    });

    return () => {
      supabase.removeChannel(incomingChannel);
      supabase.removeChannel(outgoingChannel);
      supabase.removeChannel(updateChannel);
      typingUnsub();
      setOtherTyping(false);
      setPartnerProfile(null);
    };
  }, [clearConversationUnread, scheduleMarkRead, selectedId, upsertConversationFromMessage, user?.id]);

  // Liga-hold chat
  useEffect(() => {
    if (!selectedTeamId || !user?.id) {
      setTeamMessages([]);
      setTeamLoadError(null);
      return;
    }

    let cancelled = false;
    setTeamLoading(true);
    setTeamLoadError(null);

    fetchLeagueTeamMeta(selectedTeamId)
      .then((meta) => { if (!cancelled && meta) setTeamMeta(meta); })
      .catch(() => {});

    fetchLeagueTeamMessages(selectedTeamId)
      .then((rows) => { if (!cancelled) setTeamMessages(rows); })
      .catch(() => {
        if (!cancelled) setTeamLoadError('Kunne ikke hente beskeder.');
      })
      .finally(() => { if (!cancelled) setTeamLoading(false); });

    const unsubscribe = subscribeToLeagueTeamMessages(
      selectedTeamId,
      (row) => {
        if (!row?.id) return;
        setTeamMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      },
      (row) => {
        if (!row?.id) return;
        setTeamMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      }
    );

    const typingUnsub = subscribeTeamTyping(selectedTeamId, user.id, () => {
      setOtherTyping(true);
      window.setTimeout(() => setOtherTyping(false), 2800);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      typingUnsub();
      setOtherTyping(false);
    };
  }, [selectedTeamId, user?.id]);

  useEffect(() => {
    setChatVisibleCount(CHAT_WINDOW_SIZE);
    prevMessageCountRef.current = 0;
    shouldStickToBottomRef.current = true;
    lastScrolledMessageIdRef.current = null;
  }, [selectedId, selectedTeamId]);

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

  const upsertTeamConversationFromMessage = useCallback((msg) => {
    if (!msg || !selectedTeamId) return;
    const previewText = messagePreview(msg);
    setTeamConversations((prev) => {
      const idx = prev.findIndex((c) => c.teamId === selectedTeamId);
      const nextItem = {
        type: 'league_team',
        teamId: selectedTeamId,
        teamName: teamMeta?.teamName || 'Hold',
        leagueId: teamMeta?.leagueId,
        leagueName: teamMeta?.leagueName || '',
        lastMessage: msg,
        preview: `Dig: ${previewText}`,
        unread: 0,
      };
      if (idx >= 0) {
        return prev.map((c, i) => (i === idx ? nextItem : c)).sort(
          (a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
        );
      }
      return [nextItem, ...prev];
    });
  }, [selectedTeamId, teamMeta?.leagueId, teamMeta?.leagueName, teamMeta?.teamName]);

  const handleTeamSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedTeamId || teamSending || !user?.id) return;
    setTeamSending(true);
    setInputText('');
    try {
      const msg = await sendLeagueTeamMessage({
        teamId: selectedTeamId,
        leagueId: teamMeta?.leagueId,
        senderId: user.id,
        senderName: user.full_name || user.name || 'Spiller',
        senderAvatar: user.avatar || null,
        content: text,
      });
      if (msg) {
        setTeamMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        upsertTeamConversationFromMessage(msg);
      }
    } catch {
      setInputText(text);
      showToast?.('Kunne ikke sende besked. Prøv igen.');
    } finally {
      setTeamSending(false);
    }
  };

  const sendRichMessage = async ({ messageType, payload, content = '' }) => {
    if (selectedTeamId) {
      if (teamSending || !user?.id) return;
      setTeamSending(true);
      try {
        const msg = await sendLeagueTeamMessage({
          teamId: selectedTeamId,
          leagueId: teamMeta?.leagueId,
          senderId: user.id,
          senderName: user.full_name || user.name || 'Spiller',
          senderAvatar: user.avatar || null,
          content,
          messageType,
          payload,
        });
        if (msg) {
          setTeamMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          upsertTeamConversationFromMessage(msg);
        }
      } catch {
        showToast?.('Kunne ikke sende besked. Prøv igen.');
      } finally {
        setTeamSending(false);
      }
      return;
    }

    if (!selectedId || sending || !user?.id) return;
    setSending(true);
    try {
      const msg = await sendMessage(user.id, selectedId, content, { messageType, payload });
      setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
      upsertConversationFromMessage(msg);
    } catch (e) {
      const errMsg = String(e?.message || '');
      if (errMsg.toLowerCase().includes('bloker')) {
        void refreshBlockState();
        showToast?.('Du kan ikke sende beskeder til denne bruger.');
      } else {
        showToast?.('Kunne ikke sende besked. Prøv igen.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = useCallback((next) => {
    setInputText(next);
    if (selectedTeamId && user?.id) {
      broadcastTeamTyping(selectedTeamId, user.id);
    } else if (selectedId && user?.id) {
      broadcastDmTyping(user.id, selectedId);
    }
  }, [selectedId, selectedTeamId, user?.id]);

  const handleReact = useCallback(async (message, emoji) => {
    const nextReaction = message.reaction === emoji ? '' : emoji;
    try {
      if (selectedTeamId) {
        const updated = await setLeagueTeamMessageReaction(message.id, nextReaction);
        if (updated) {
          setTeamMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      } else {
        const updated = await setDmMessageReaction(message.id, nextReaction);
        if (updated) {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      }
    } catch {
      showToast?.('Kunne ikke gemme reaktion.');
    }
  }, [selectedTeamId, showToast]);

  const handleJoinInvite = useCallback(async (invite) => {
    if (!invite?.match_id || !user?.id || joiningInviteId) return;
    setJoiningInviteId(invite.match_id);
    try {
      const result = await joinMatchFromChatInvite({
        matchId: invite.match_id,
        userId: user.id,
        userName: user.full_name || user.name || 'Spiller',
        userEmail: user.email,
        userAvatar: user.avatar,
      });
      showToast?.(result?.alreadyJoined ? 'Du er allerede tilmeldt kampen.' : 'Du er tilmeldt kampen!');
    } catch {
      showToast?.('Kunne ikke tilmelde kampen.');
    } finally {
      setJoiningInviteId(null);
    }
  }, [joiningInviteId, showToast, user]);

  const openMatchPicker = async () => {
    setActionSheet('match');
    setPickerLoading(true);
    try {
      const rows = await fetchInvitableMatches(user.id);
      setInvitableMatches(rows);
    } catch {
      showToast?.('Kunne ikke hente dine kampe.');
      setActionSheet(null);
    } finally {
      setPickerLoading(false);
    }
  };

  const openVenuePicker = async () => {
    setActionSheet('venue');
    setPickerLoading(true);
    try {
      const rows = await fetchShareableCourts();
      setShareableCourts(rows);
    } catch {
      showToast?.('Kunne ikke hente baner.');
      setActionSheet(null);
    } finally {
      setPickerLoading(false);
    }
  };

  const openTimePicker = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTimeDraft({
      date: tomorrow.toISOString().slice(0, 10),
      time: '18:00',
    });
    setActionSheet('time');
  };

  const handlePickMatch = async (match) => {
    setActionSheet(null);
    try {
      const payload = await buildInvitePayloadForMatch(match);
      await sendRichMessage({
        messageType: CHAT_MESSAGE_TYPES.MATCH_INVITE,
        payload,
        content: payload.title,
      });
    } catch {
      showToast?.('Kunne ikke sende invitation.');
    }
  };

  const handlePickCourt = async (court) => {
    setActionSheet(null);
    const payload = buildVenueSharePayload(court);
    await sendRichMessage({
      messageType: CHAT_MESSAGE_TYPES.VENUE_SHARE,
      payload,
      content: payload.venue,
    });
  };

  const handlePickTime = async () => {
    if (!timeDraft.date) {
      showToast?.('Vælg en dato.');
      return;
    }
    setActionSheet(null);
    const payload = buildTimeSuggestionPayload(timeDraft.date, timeDraft.time);
    await sendRichMessage({
      messageType: CHAT_MESSAGE_TYPES.TIME_SUGGESTION,
      payload,
      content: payload.label,
    });
  };

  const handleSend = async () => {
    if (selectedTeamId) {
      await handleTeamSend();
      return;
    }
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
    setSelectedTeamId(null);
    setTeamMeta(null);
    navigate('/dashboard/beskeder', { replace: true });
    ensureProfile(otherId);
    setComposeOpen(false);
    setComposeQuery('');
    setComposeResults([]);
  };

  const openTeamConversation = (teamId) => {
    setSelectedTeamId(teamId);
    setSelectedId(null);
    navigate(`/dashboard/beskeder?hold=${teamId}`, { replace: true });
    setComposeOpen(false);
    setComposeQuery('');
    setComposeResults([]);
  };

  const closeThread = () => {
    setSelectedId(null);
    setSelectedTeamId(null);
    setTeamMeta(null);
    navigate('/dashboard/beskeder', { replace: true });
  };

  const mobileChatActive = Boolean((selectedId || selectedTeamId) && isMobileView);

  // The mobile conversation is a full-screen overlay pinned to the *visual*
  // viewport. On iOS the on-screen keyboard shifts the visual viewport down
  // inside the layout viewport (vv.offsetTop > 0) and shrinks it (vv.height),
  // while `position: fixed` stays anchored to the layout viewport. We therefore
  // drive top/height from visualViewport directly so the input bar always sits
  // right above the keyboard — and there's no dead space when it closes.
  const updateMobileChatViewport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const next = vv
      ? { top: Math.round(vv.offsetTop), height: Math.round(vv.height) }
      : { top: 0, height: window.innerHeight };
    setMobileChatViewport((prev) => {
      if (prev && prev.top === next.top && prev.height === next.height) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mobileChatActive || typeof window === 'undefined') return undefined;
    const handle = () => updateMobileChatViewport();
    updateMobileChatViewport();
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle);
    window.visualViewport?.addEventListener('resize', handle);
    window.visualViewport?.addEventListener('scroll', handle);

    // Lock the page behind the overlay. Plain `overflow: hidden` is not enough
    // on iOS: focusing the input inside a fixed overlay makes Safari scroll the
    // window to "reveal" it, so on close the dashboard is left scrolled up.
    // Pinning the body with position:fixed at the current scroll offset prevents
    // that, and we restore the exact scroll position on close.
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
      window.visualViewport?.removeEventListener('resize', handle);
      window.visualViewport?.removeEventListener('scroll', handle);
      // Blur any focused field so iOS doesn't keep the keyboard/scroll state.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      root.style.overflow = prev.rootOverflow;
      // Restore the scroll position the dashboard had before the chat opened.
      window.scrollTo(0, scrollY);
      setMobileChatViewport(null);
    };
  }, [mobileChatActive, updateMobileChatViewport]);

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

  const inboxItems = useMemo(() => {
    const dmItems = conversations.map((convo) => {
      const p = profiles[convo.otherId];
      const isFromMe = convo.lastMessage.sender_id === user.id;
      const previewText = messagePreview(convo.lastMessage);
      return {
        key: `dm:${convo.otherId}`,
        kind: 'dm',
        id: convo.otherId,
        title: p?.full_name || p?.name || 'Spiller',
        avatarId: convo.otherId,
        avatarUrl: p?.avatar || null,
        preview: `${isFromMe ? 'Dig: ' : ''}${previewText}`,
        time: convo.lastMessage.created_at,
        unread: convo.unread,
        online: isUserOnline(p?.last_active_at),
      };
    });

    const teamItems = teamConversations.map((convo) => ({
      key: `team:${convo.teamId}`,
      kind: 'team',
      id: convo.teamId,
      title: `${convo.teamName} 🎾`,
      avatarId: convo.teamId,
      preview: convo.preview || convo.lastMessage?.content || '',
      time: convo.lastMessage?.created_at,
      unread: convo.unread || 0,
    }));

    return [...dmItems, ...teamItems].sort(
      (a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()
    );
  }, [conversations, teamConversations, profiles, user.id]);

  const threadShellClass = mobileChatActive
    ? 'pm-chat-v2-thread pm-chat-v2-thread--mobile'
    : 'pm-chat-v2-thread';

  // ── Beskedtråd (DM eller liga-hold) ───────────────────────────────────────
  if (selectedId || selectedTeamId) {
    const isTeamThread = Boolean(selectedTeamId);
    const otherProfile = !isTeamThread ? (partnerProfile || profiles[selectedId]) : null;
    const chatIsBlocked = !isTeamThread && dmHiddenIds.has(String(selectedId));
    const iBlockedThem = !isTeamThread && blockedByMeIds.has(String(selectedId));
    const partnerOnline = !isTeamThread && isUserOnline(otherProfile?.last_active_at);
    const hiddenMessageCount = isTeamThread
      ? 0
      : Math.max(0, messages.length - chatVisibleCount);
    const visibleMessages = isTeamThread
      ? teamMessages
      : (hiddenMessageCount > 0 ? messages.slice(-chatVisibleCount) : messages);
    const threadTitle = isTeamThread
      ? (teamMeta?.teamName || 'Hold')
      : getName(selectedId);
    const threadSubtitle = isTeamThread
      ? (teamMeta?.leagueName ? `Liga · ${teamMeta.leagueName}` : 'Liga-hold')
      : onlineStatusLabel(otherProfile?.last_active_at, {
          elo: otherProfile?.elo_rating,
          level: otherProfile?.level,
        });

    return (
      <div
        className={threadShellClass}
        style={mobileChatActive && mobileChatViewport ? {
          top: `${mobileChatViewport.top}px`,
          height: `${mobileChatViewport.height}px`,
          bottom: 'auto',
        } : undefined}
      >
        <ChatThreadHeader
          title={threadTitle}
          subtitle={threadSubtitle}
          avatarId={isTeamThread ? selectedTeamId : selectedId}
          avatarName={threadTitle}
          avatarUrl={otherProfile?.avatar || null}
          online={partnerOnline}
          onBack={closeThread}
          actionsSlot={!isTeamThread ? (
            <BeskedChatActions
              otherUserId={selectedId}
              otherName={getName(selectedId)}
              iBlockedThem={iBlockedThem}
              onBlocked={async () => {
                await refreshBlockState();
                closeThread();
                void loadConversations();
              }}
              onUnblocked={async () => {
                await refreshBlockState();
                void loadConversations();
              }}
            />
          ) : null}
        />

        {!isTeamThread && chatIsBlocked && (
          <div className="pm-chat-v2-blocked">
            {iBlockedThem
              ? `Du har blokeret ${getName(selectedId)}. Fjern blokeringen via ⋮ for at skrive igen.`
              : `Du kan ikke sende beskeder til ${getName(selectedId)} i denne samtale.`}
          </div>
        )}

        <ChatMessageList
          listRef={messagesPaneRef}
          userId={user.id}
          messages={visibleMessages}
          loading={isTeamThread ? teamLoading : loadingMsgs}
          error={isTeamThread ? teamLoadError : messageLoadError}
          emptyText={
            isTeamThread
              ? `Skriv den første besked til ${threadTitle}.`
              : `Start samtalen med ${getName(selectedId)}`
          }
          groupMode
          showSenderNames={isTeamThread}
          typingVisible={otherTyping}
          onReact={handleReact}
          onJoinInvite={handleJoinInvite}
          joiningInviteId={joiningInviteId}
          onScroll={updateStickToBottom}
          loadOlderSlot={!isTeamThread && hiddenMessageCount > 0 ? (
            <div className="pm-besked-load-older">
              <button
                type="button"
                className="pm-ui-btn-chip"
                onClick={() => setChatVisibleCount((prev) => Math.min(messages.length, prev + CHAT_WINDOW_SIZE))}
              >
                Vis {Math.min(CHAT_WINDOW_SIZE, hiddenMessageCount)} tidligere beskeder
              </button>
            </div>
          ) : null}
        />

        <div ref={bottomRef} aria-hidden style={{ height: 1, flexShrink: 0 }} />

        <ChatInputBar
          inputRef={inputRef}
          value={inputText}
          onChange={handleInputChange}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          enableQuickActions={!chatIsBlocked}
          onInviteMatch={() => void openMatchPicker()}
          onShareVenue={() => void openVenuePicker()}
          onSuggestTime={openTimePicker}
          placeholder={
            isTeamThread
              ? 'Skriv til holdet…'
              : (chatIsBlocked ? 'Beskeder er blokeret' : 'Besked…')
          }
          disabled={!isTeamThread && chatIsBlocked}
          sending={isTeamThread ? teamSending : sending}
        />

        <ChatActionSheet
          open={actionSheet === 'match'}
          title="Invitér til kamp"
          onClose={() => setActionSheet(null)}
        >
          {pickerLoading ? (
            <div className="pm-chat-v2-action-sheet-status">Henter kampe…</div>
          ) : invitableMatches.length === 0 ? (
            <div className="pm-chat-v2-action-sheet-status">Du har ingen åbne kampe at dele.</div>
          ) : (
            invitableMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                className="pm-chat-v2-action-sheet-row"
                onClick={() => void handlePickMatch(match)}
              >
                <span className="pm-chat-v2-action-sheet-row-title">{match.court_name || 'Kamp'}</span>
                <span className="pm-chat-v2-action-sheet-row-sub">
                  {match.date}{match.time ? ` · ${String(match.time).slice(0, 5)}` : ''}
                </span>
              </button>
            ))
          )}
        </ChatActionSheet>

        <ChatActionSheet
          open={actionSheet === 'venue'}
          title="Del bane"
          onClose={() => setActionSheet(null)}
        >
          {pickerLoading ? (
            <div className="pm-chat-v2-action-sheet-status">Henter baner…</div>
          ) : shareableCourts.length === 0 ? (
            <div className="pm-chat-v2-action-sheet-status">Ingen baner fundet.</div>
          ) : (
            shareableCourts.map((court) => (
              <button
                key={court.id}
                type="button"
                className="pm-chat-v2-action-sheet-row"
                onClick={() => void handlePickCourt(court)}
              >
                <span className="pm-chat-v2-action-sheet-row-title">{court.name}</span>
                {court.city ? <span className="pm-chat-v2-action-sheet-row-sub">{court.city}</span> : null}
              </button>
            ))
          )}
        </ChatActionSheet>

        <ChatActionSheet
          open={actionSheet === 'time'}
          title="Foreslå tid"
          onClose={() => setActionSheet(null)}
        >
          <div className="pm-chat-v2-time-picker">
            <label>
              Dato
              <input
                type="date"
                value={timeDraft.date}
                onChange={(e) => setTimeDraft((prev) => ({ ...prev, date: e.target.value }))}
              />
            </label>
            <label>
              Tid
              <input
                type="time"
                value={timeDraft.time}
                onChange={(e) => setTimeDraft((prev) => ({ ...prev, time: e.target.value }))}
              />
            </label>
            <button type="button" className="pm-chat-v2-time-picker-send" onClick={() => void handlePickTime()}>
              Send forslag
            </button>
          </div>
        </ChatActionSheet>
      </div>
    );
  }

  // ── Samtaleliste ──────────────────────────────────────────────────────────
  return (
    <div className="pm-besked-page">
      <ChatInbox
        items={inboxItems}
        loading={loadingConvos}
        error={convoLoadError}
        searchQuery={inboxSearch}
        onSearchChange={setInboxSearch}
        composeOpen={composeOpen}
        onToggleCompose={() => setComposeOpen((o) => !o)}
        onOpenItem={(item) => {
          if (item.kind === 'team') openTeamConversation(item.id);
          else openConversation(item.id);
        }}
        composeSlot={(
          <div className="pm-ui-card pm-besked-compose">
            <div className="pm-besked-compose-search">
              <Search size={15} color={theme.textLight} style={{ flexShrink: 0 }} />
              <input
                ref={composeRef}
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
                placeholder="Søg efter spiller..."
              />
              {composeQuery ? (
                <button
                  type="button"
                  className="pm-besked-compose-search-clear"
                  onClick={() => { setComposeQuery(''); setComposeResults([]); }}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            {composeSearching && <div className="pm-besked-compose-hint">Søger…</div>}
            {!composeSearching && composeQuery && composeResults.length === 0 && (
              <div className="pm-besked-compose-hint">
                Ingen spillere fundet.
                {setTab ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => setTab('makkere')}
                      style={{ background: 'none', border: 'none', padding: 0, color: theme.accent, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}
                    >
                      Gå til Find makker
                    </button>
                  </>
                ) : null}
              </div>
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
        emptySlot={(
          <div className="pm-state-card pm-state-card--empty" style={{ border: 'none', boxShadow: 'none' }}>
            <MessageCircle size={48} color={theme.border} style={{ marginBottom: '14px' }} aria-hidden />
            <div className="pm-state-title">Ingen samtaler endnu</div>
            <div className="pm-state-copy">
              Tryk compose-knappen for at starte en samtale — eller skriv til et hold under{' '}
              {setTab ? (
                <button
                  type="button"
                  onClick={() => setTab('kampe')}
                  style={{ background: 'none', border: 'none', padding: 0, color: theme.accent, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}
                >
                  Liga
                </button>
              ) : (
                'Liga'
              )}
              .
            </div>
          </div>
        )}
      />
      {convoLoadError ? (
        <div className="pm-state-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void loadConversations()} style={{ ...btn(true), fontSize: '13px' }}>
            Prøv igen
          </button>
        </div>
      ) : null}
    </div>
  );
}

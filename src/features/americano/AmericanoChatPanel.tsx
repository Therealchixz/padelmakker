/**
 * Chat i en Americano/Mexicano for tilmeldte og opretteren.
 * Ser ud som kamp-chatten (samme klasser), men bor i sin egen komponent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, MessageCircle, SendHorizontal } from 'lucide-react'
import { btn } from '../../lib/platformTheme'
import {
  fetchAmericanoMessages,
  notifyAmericanoChat,
  sendAmericanoMessage,
  subscribeToAmericanoMessages,
} from '../../lib/americanoChatUtils'

type ChatMessage = {
  id: string
  sender_id: string
  sender_name: string | null
  content: string
  created_at: string
}

type Props = {
  tournamentId: string
  userId: string
  userName: string
  userAvatar?: string | null
  /** Alle andre, der skal have besked (tilmeldte + opretter). */
  recipientIds: string[]
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

function clock(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
}

export function AmericanoChatPanel({ tournamentId, userId, userName, userAvatar, recipientIds, showToast }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const addMessage = useCallback((msg: ChatMessage | null) => {
    if (!msg?.id) return
    setMessages((prev) => (prev.some((m) => String(m.id) === String(msg.id)) ? prev : [...prev, msg].slice(-200)))
  }, [])

  // Antal beskeder vises på knappen, også før chatten åbnes.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetchAmericanoMessages(tournamentId)
      .then((rows) => { if (alive) setMessages(rows as ChatMessage[]) })
      .catch(() => { if (alive) setError('Kunne ikke hente beskeder.') })
      .finally(() => { if (alive) setLoading(false) })
    const unsubscribe = subscribeToAmericanoMessages(tournamentId, (row: unknown) => addMessage(row as ChatMessage | null))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [tournamentId, addMessage])

  useEffect(() => {
    if (open) window.requestAnimationFrame(scrollToBottom)
  }, [open, messages.length, scrollToBottom])

  const submit = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const created = await sendAmericanoMessage({
        tournamentId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar || null,
        content,
      })
      addMessage(created as ChatMessage | null)
      setDraft('')
      void notifyAmericanoChat({
        tournamentId,
        recipientIds: recipientIds.filter((id) => String(id) !== String(userId)),
        senderName: userName,
        content,
      }).then((err) => {
        if (err) console.warn('americano chat notify:', (err as { message?: string })?.message || err)
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kunne ikke sende besked.'
      showToast?.(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pm-kd-action-card">
      <button
        type="button"
        className="pm-kd-action-chat"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Chat"
      >
        <span className="pm-kd-action-chat-ic" aria-hidden>
          <MessageCircle size={18} />
        </span>
        <span className="pm-kd-action-chat-copy">
          <b>Chat{messages.length > 0 ? ` (${messages.length})` : ''}</b>
        </span>
        <ChevronRight size={18} className="pm-kd-action-chevron" aria-hidden />
      </button>
      {open ? (
        <div className="pm-kd-action-chat-panel">
          <div className="pm-card-subpanel pm-match-chat-panel" style={{ marginBottom: 0 }}>
            <div className="pm-match-chat-list" ref={listRef}>
              {loading ? <div className="pm-match-chat-empty">Henter beskeder...</div> : null}
              {!loading && error ? <div className="pm-match-chat-empty">{error}</div> : null}
              {!loading && !error && messages.length === 0 ? (
                <div className="pm-match-chat-empty">Ingen beskeder endnu. Skriv den første besked til de andre spillere.</div>
              ) : null}
              {!loading && !error && messages.map((msg) => {
                const mine = String(msg.sender_id) === String(userId)
                return (
                  <div key={msg.id} className={`pm-match-chat-row ${mine ? 'pm-match-chat-row--mine' : ''}`}>
                    <div className={`pm-match-chat-bubble ${mine ? 'pm-match-chat-bubble--mine' : ''}`}>
                      <div className="pm-match-chat-meta">
                        <span className="pm-match-chat-author">{mine ? 'Dig' : (msg.sender_name || 'Spiller').trim()}</span>
                        <span>{clock(msg.created_at)}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pm-match-chat-composer">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submit()
                  }
                }}
                placeholder="Skriv til de andre spillere..."
                className="pm-match-chat-input"
                maxLength={1000}
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => { void submit() }}
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
                <SendHorizontal size={13} />
                {sending ? 'Sender...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

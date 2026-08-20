import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

const MAX_MESSAGE_LENGTH = 500
const MESSAGE_LIMIT = 100
const MIN_SEND_INTERVAL_MS = 800 // light client-side throttle, not real spam protection

function displayNameFor(email) {
  if (!email) return 'someone'
  return email.split('@')[0]
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function ChatWidget({ session, configured }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const listRef = useRef(null)
  const lastSentAtRef = useRef(0)

  useEffect(() => {
    if (!configured || !session) {
      setIsAdmin(false)
      return
    }
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [configured, session])

  useEffect(() => {
    if (!configured) return

    loadMessages()

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open])

  async function loadMessages() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT)
    if (!fetchError && data) {
      setMessages(data.slice().reverse())
    } else if (fetchError) {
      console.error('Failed to load chat messages:', fetchError)
    }
    setLoading(false)
  }

  async function handleSend(e) {
    e.preventDefault()
    setError('')
    const trimmed = draft.trim()
    if (!trimmed || !session) return

    const now = Date.now()
    if (now - lastSentAtRef.current < MIN_SEND_INTERVAL_MS) return
    lastSentAtRef.current = now

    setSending(true)
    const { error: sendError } = await supabase.from('messages').insert({
      user_id: session.user.id,
      user_email: session.user.email,
      content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
    })
    setSending(false)

    if (sendError) {
      console.error('Failed to send chat message:', sendError)
      setError(`Message failed to send: ${sendError.message}`)
    } else {
      setDraft('')
    }
  }

  async function deleteMessage(id) {
    const { error: deleteError } = await supabase.from('messages').delete().eq('id', id)
    if (deleteError) {
      console.error('Failed to delete message:', deleteError)
      setError(`Couldn't delete that message: ${deleteError.message}`)
      return
    }
    // Remove locally right away rather than waiting on the realtime event.
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  async function clearAllMessages() {
    const confirmed = window.confirm(
      `Delete all ${messages.length} message${messages.length === 1 ? '' : 's'}? This can't be undone.`
    )
    if (!confirmed) return

    const { error: clearError } = await supabase
      .from('messages')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z') // matches every row; the API requires some filter
    if (clearError) {
      console.error('Failed to clear messages:', clearError)
      setError(`Couldn't clear messages: ${clearError.message}`)
      return
    }
    setMessages([])
  }

  if (!configured) return null

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>Global chat</span>
            <div className="chat-header-actions">
              {isAdmin && messages.length > 0 && (
                <button className="chat-clear-all" onClick={clearAllMessages} title="Delete all messages">
                  clear all
                </button>
              )}
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                ✕
              </button>
            </div>
          </div>

          <div className="chat-messages" ref={listRef}>
            {loading ? (
              <p className="chat-empty">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="chat-empty">No messages yet — say hello.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="chat-message">
                  <div className="chat-message-meta">
                    <span className="chat-author">{displayNameFor(m.user_email)}</span>
                    <span className="chat-time">{formatTime(m.created_at)}</span>
                    {isAdmin && (
                      <button
                        className="chat-message-delete"
                        onClick={() => deleteMessage(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="chat-content">{m.content}</p>
                </div>
              ))
            )}
          </div>

          {session ? (
            <form className="chat-input-row" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Say something..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <button type="submit" disabled={sending || !draft.trim()}>
                send
              </button>
            </form>
          ) : (
            <p className="chat-signed-out">Sign in above to join the conversation.</p>
          )}

          {error && <p className="chat-error">{error}</p>}

          <p className="chat-disclaimer">Public and visible to everyone.</p>
        </div>
      )}

      <button
        className="chat-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open global chat'}
        title={open ? 'Close chat' : 'Open global chat'}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}

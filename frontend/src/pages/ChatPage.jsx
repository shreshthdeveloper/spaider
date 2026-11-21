import { useEffect, useRef, useState } from 'react'
import ChatMessage from '../components/ChatMessage'
import Composer from '../components/Composer'
import Icon from '../components/Icon'
import SpiderLoader from '../components/SpiderLoader'
import { SpiderArt } from '../components/SpiderLoader'
import { getChat, sendChat } from '../lib/api'
import { loadCurrentChatId, saveCurrentChatId } from '../lib/currentChat'
import { go } from '../lib/router'

const SUGGESTIONS = [
  { icon: 'code', text: 'Ask me one Python interview question' },
  { icon: 'target', text: 'Quiz me on REST API design' },
  { icon: 'sparkle', text: 'Explain RAG in simple words' },
  { icon: 'layers', text: 'Give me a system design warm-up question' },
]

let nextId = 1

// #/chat?quiz=<topic> (a fly on the Stats page's web): the quiz request, ready to send. '' otherwise.
function quizRequest() {
  const topic = new URLSearchParams(window.location.hash.split('?')[1] || '').get('quiz')
  return topic ? `Quiz me with 3 short questions on ${topic}. Ask one at a time and wait for my answer.` : ''
}

// #/chat             -> the chat you had open last (or a new one)
// #/chat/<id>        -> that chat, e.g. picked from "Recent chats" in the sidebar
// #/chat?quiz=<topic> -> a new chat with a quiz request already typed in
export default function ChatPage({ arg }) {
  const [quiz] = useState(quizRequest)
  const [messages, setMessages] = useState([]) // { id, role: 'user' | 'ai', content, tokens }
  const [sessionId, setSessionId] = useState(() => (quiz ? null : arg || loadCurrentChatId()))
  const [restoring, setRestoring] = useState(() => !quiz && Boolean(arg || loadCurrentChatId()))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [failedText, setFailedText] = useState(null)
  const logRef = useRef(null)

  const totalTokens = messages.reduce((sum, m) => sum + (m.tokens?.total_tokens || 0), 0)
  const firstQuestion = messages.find((m) => m.role === 'user')?.content

  // On load, bring back the chat from the link, or the last one you had open (not for a new quiz).
  useEffect(() => {
    const id = quiz ? null : arg || loadCurrentChatId()
    if (!id) return
    getChat(id)
      .then((data) => {
        setMessages(data.messages.map((m) => ({ ...m, id: nextId++ })))
        saveCurrentChatId(id)
      })
      .catch((err) => {
        if (err.status === 404) {
          saveCurrentChatId(null)
          setSessionId(null)
          if (arg) setError('That chat was not found. It may have been deleted.')
        } else {
          setError(`Couldn't load the chat. ${err.message}`)
        }
      })
      .finally(() => setRestoring(false))
  }, [arg, quiz])

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, error])

  async function send(text, { retry = false } = {}) {
    if (!text || pending) return
    if (!retry) setMessages((prev) => [...prev, { id: nextId++, role: 'user', content: text }])
    setPending(true)
    setError('')
    setFailedText(null)

    try {
      const data = await sendChat(text, sessionId)
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id)
        saveCurrentChatId(data.session_id)
      }
      setMessages((prev) => [...prev, { id: nextId++, role: 'ai', content: data.reply, tokens: data.tokens }])
    } catch (err) {
      setError(err.message)
      setFailedText(text)
    } finally {
      setPending(false)
    }
  }

  function newChat() {
    saveCurrentChatId(null)
    if (arg) {
      go('chat') // leave #/chat/<id>; the page opens fresh
      return
    }
    setMessages([])
    setSessionId(null)
    setError('')
    setFailedText(null)
  }

  const showWelcome = messages.length === 0 && !pending && !restoring

  return (
    <div className="page chat-page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1>Practice chat</h1>
          <p className="muted">Warm up before an interview: ask anything, or ask to be quizzed.</p>
        </div>
      </header>

      <section className="card chat-card">
        <div className="chat-bar">
          <div className="chat-bar-text">
            <div className="chat-bar-title">{firstQuestion || 'New conversation'}</div>
            <div className="muted small">
              {messages.length > 0 ? `${messages.length} messages · saved` : 'Your first message starts a saved chat'}
            </div>
          </div>
          {totalTokens > 0 && (
            <span className="chip token-chip" title="Tokens used in this chat">
              <Icon name="bolt" size={14} />
              {totalTokens.toLocaleString()} tokens
            </span>
          )}
          <button className="small" onClick={newChat} disabled={(!messages.length && !sessionId) || pending}>
            <Icon name="plus" size={15} />
            New chat
          </button>
        </div>

        <div className="chat-log" ref={logRef}>
          {restoring && <SpiderLoader label="Loading your last chat…" />}

          {showWelcome && (
            <div className="chat-welcome">
              <div className="welcome-spider spider-alive">
                <SpiderArt />
              </div>
              <h2>Start a practice session</h2>
              <p className="muted">Pick a starter or type your own message below.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} className="suggestion" onClick={() => send(s.text)}>
                    <span className="suggestion-icon">
                      <Icon name={s.icon} size={16} />
                    </span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} content={m.content} tokens={m.tokens} />
          ))}

          {pending && <ChatMessage role="ai" pending />}
        </div>

        {error && (
          <div className="chat-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
            {failedText && (
              <button className="small" onClick={() => send(failedText, { retry: true })}>
                <Icon name="repeat" size={14} />
                Try again
              </button>
            )}
          </div>
        )}

        <Composer onSend={send} disabled={pending || restoring} initialText={quiz} />
      </section>
    </div>
  )
}

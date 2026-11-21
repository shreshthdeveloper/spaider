import { useState } from 'react'
import { Markdown } from '../lib/markdown'
import Icon from './Icon'
import { SpiderArt } from './SpiderLoader'

function TypingDots() {
  return (
    <span className="typing" aria-label="Coach is typing">
      <span />
      <span />
      <span />
    </span>
  )
}

// One message in the chat. The user's text is shown as typed; the coach's reply
// is rendered as Markdown, with its token count and a copy button underneath.
export default function ChatMessage({ role, content, tokens, pending = false }) {
  const [copied, setCopied] = useState(false)

  if (role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-bubble">{content}</div>
      </div>
    )
  }

  function copy() {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  return (
    <div className="msg ai">
      <div className="msg-avatar spider-face">
        <SpiderArt />
      </div>
      <div className="msg-body">
        <div className="msg-name">Coach</div>
        <div className="msg-bubble">{pending ? <TypingDots /> : <Markdown text={content} />}</div>
        {!pending && (
          <div className="msg-meta">
            {tokens?.total_tokens ? <span>{tokens.total_tokens.toLocaleString()} tokens</span> : null}
            <button className="msg-action" onClick={copy} title="Copy this answer">
              <Icon name={copied ? 'check' : 'copy'} size={13} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

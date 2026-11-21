import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// The message box. Enter sends, Shift + Enter adds a new line,
// and the box grows with the text up to a limit. initialText is already typed in (you still send it).
export default function Composer({ onSend, disabled, placeholder = 'Message your coach…', initialText = '' }) {
  const [text, setText] = useState(initialText)
  const boxRef = useRef(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 180)}px`
  }, [text])

  function submit() {
    const message = text.trim()
    if (!message || disabled) return
    onSend(message)
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          ref={boxRef}
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button type="submit" className="primary send-btn" disabled={disabled || !text.trim()} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
      <div className="composer-hint">
        <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span> + <span className="kbd">Enter</span> for a new line
      </div>
    </div>
  )
}

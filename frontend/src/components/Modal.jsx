import { useEffect, useRef } from 'react'
import Icon from './Icon'

// A pop-up window over the page. It is a <dialog>, so the browser keeps focus inside it;
// Esc, the close button or a click on the dark backdrop closes it.
//   open, onClose   whether it shows, and what closing does
//   title, subtitle the heading
//   children        the content (only rendered while open)
//   side            true: a panel that slides in from the right, instead of a box in the middle
export default function Modal({ open, title, subtitle, onClose, children, side = false }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc: let React decide, so `open` stays the one source of truth.
  function handleCancel(e) {
    e.preventDefault()
    onClose()
  }

  // A click on the dark backdrop lands on the <dialog> itself, not on the box inside it.
  function handleClick(e) {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog ref={dialogRef} className={side ? 'modal side' : 'modal'} onCancel={handleCancel} onClick={handleClick}>
      <div className="modal-box">
        <header className="modal-head">
          <div className="modal-title">
            <h2>{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal-body">{open && children}</div>
      </div>
    </dialog>
  )
}

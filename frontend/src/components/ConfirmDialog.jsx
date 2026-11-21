import { useEffect, useRef } from 'react'
import Icon from './Icon'

// An "Are you sure?" box, used instead of the browser's confirm().
// It is a <dialog>, so the browser keeps focus inside it and Esc closes it.
export default function ConfirmDialog({ open, icon = 'alert', title, text, confirmLabel = 'OK', danger = false, onConfirm, onCancel }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc: let React decide, so `open` stays the one source of truth.
  function handleCancel(e) {
    e.preventDefault()
    onCancel()
  }

  // A click on the dark backdrop lands on the <dialog> itself, not on the box inside it.
  function handleClick(e) {
    if (e.target === dialogRef.current) onCancel()
  }

  return (
    <dialog ref={dialogRef} className="confirm-dialog" onCancel={handleCancel} onClick={handleClick}>
      <div className="confirm-box">
        <span className={`confirm-icon${danger ? ' danger' : ''}`}>
          <Icon name={icon} size={20} />
        </span>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="confirm-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className={danger ? 'danger-solid' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

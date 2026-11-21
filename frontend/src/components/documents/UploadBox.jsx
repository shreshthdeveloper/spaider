import { useRef } from 'react'
import Icon from '../Icon'

// The upload box: click it (or press Enter) to choose a PDF.
// Dropping a file works anywhere on the page (DocumentsPage handles that); while a file is
// dragged over the page, `dragging` makes this box light up.
export default function UploadBox({ onFile, busy, dragging }) {
  const inputRef = useRef(null)

  function choose() {
    if (!busy) inputRef.current?.click()
  }

  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      onClick={choose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          choose()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = '' // lets you pick the same file again
        }}
      />
      <span className="drop-icon">
        <Icon name="upload" size={24} />
      </span>
      <div className="drop-title">{dragging ? 'Drop it to upload' : 'Drop a PDF here, or click to choose'}</div>
      <div className="muted small">Text PDFs up to 10 MB · drag onto any part of this page</div>
      <span className="drop-button">
        <Icon name="file" size={15} />
        Choose a PDF
      </span>
    </div>
  )
}

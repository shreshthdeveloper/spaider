import { toPng } from 'html-to-image'
import { useState } from 'react'
import Icon from './Icon'
import { SpiderArt } from './SpiderLoader'

// Two buttons to share a report: a PNG image of it, or a PDF (through the browser's print window,
// where you pick "Save as PDF"). Anything marked className="no-export" (like these buttons) is left out.
//   target  a ref to the element to export
//   name    the file name, without the extension
export default function ExportReport({ target, name }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function downloadImage() {
    const element = target.current
    if (!element || busy) return
    setBusy(true)
    setError('')
    element.classList.add('exporting') // shows the SpAIder line at the bottom (see ExportBrand)
    try {
      const background = getComputedStyle(document.body).backgroundColor
      const url = await toPng(element, { pixelRatio: 2, backgroundColor: background, filter: keepInExport })
      const link = document.createElement('a')
      link.download = `${fileName(name)}.png`
      link.href = url
      link.click()
    } catch {
      setError("Couldn't make the image. Try the PDF instead.")
    } finally {
      element.classList.remove('exporting')
      setBusy(false)
    }
  }

  function savePdf() {
    const element = target.current
    if (!element) return
    // print only the report (see "printing a report" in base.css), and in light colours: dark pages waste ink
    const root = document.documentElement
    const theme = root.dataset.theme
    root.dataset.theme = 'light'
    element.classList.add('print-target')
    window.addEventListener(
      'afterprint',
      () => {
        element.classList.remove('print-target')
        root.dataset.theme = theme
      },
      { once: true },
    )
    window.print()
  }

  return (
    <>
      <button onClick={downloadImage} disabled={busy} title="Download the report as a PNG image">
        {busy ? <span className="spinner small" /> : <Icon name="download" size={16} />}
        Image
      </button>
      <button onClick={savePdf} title="Save the report as a PDF (choose “Save as PDF” in the print window)">
        <Icon name="printer" size={16} />
        PDF
      </button>
      {error && <span className="export-error">{error}</span>}
    </>
  )
}

// The line at the bottom of an exported report, so a shared report says where it came from.
// Hidden on screen; shown in the image and the PDF.
export function ExportBrand() {
  const [today] = useState(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }))
  return (
    <div className="export-brand">
      <span className="export-brand-logo">
        <SpiderArt />
      </span>
      <span>
        <b>
          Sp<span className="brand-ai">AI</span>der
        </b>{' '}
        · Catches your weak spots before the interviewer does
      </span>
      <span className="export-brand-date">{today}</span>
    </div>
  )
}

function keepInExport(node) {
  return !(node.classList && node.classList.contains('no-export'))
}

// "Two Sum: interview" -> "two-sum-interview"
function fileName(text) {
  const name = (text || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return name.slice(0, 60) || 'report'
}

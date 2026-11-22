import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPanelLive, endPanel, getPanel, retryPanel } from '../../lib/api'
import { useInterviewVoice } from '../../lib/useInterviewVoice'
import ConfirmDialog from '../ConfirmDialog'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import PanelCall from './PanelCall'
import PanelReport from './PanelReport'
import PanelRoom from './PanelRoom'

const NO_LINES = [] // the same empty list every time (see useInterviewVoice)

const BUSY_TEXT = {
  ending: 'The panel is deciding on what you answered so far…',
  retrying: 'Trying again…',
}

// #/panel/<id>: loads the panel interview, then shows it while it runs and the report once it's done.
// Voice on = a video call where each panelist speaks in their own voice (PanelCall); voice off = the text
// room (PanelRoom). This component owns the answer, the live steps and the backend calls; those two only draw.
export default function PanelSession({ id }) {
  const [panel, setPanel] = useState(null)
  const [missing, setMissing] = useState(false)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState('loading') // '' when idle, or 'loading' | 'answering' | 'ending' | 'retrying'
  const [error, setError] = useState('')
  const [steps, setSteps] = useState([]) // the live steps of the answer being handled: [{ id, node, who, done }]
  const [confirmEnd, setConfirmEnd] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    getPanel(id)
      .then(setPanel)
      .catch((err) => (err.status === 404 ? setMissing(true) : setError(err.message)))
      .finally(() => setBusy(''))
  }, [id])

  // The asking panelist reads each question aloud in their own voice (in a video call), and you can answer
  // with the mic. The same hook as the mock interview, with that panelist's voice.
  const questionText = panel?.question?.question
  const asker = panel?.panel.find((panelist) => panelist.id === panel.question?.speaker)
  // Before the first question, the panel introduces itself: each panelist in their own voice.
  const firstTurn = Boolean(panel) && panel.answered === 0 && panel.transcript.length === 0
  const intros = panel?.intros
  const preface = useMemo(() => {
    if (!firstTurn || !intros) return NO_LINES
    return intros.map((line) => ({ text: line.text, voice: line.voice }))
  }, [firstTurn, intros])
  const voice = useInterviewVoice(questionText, panel?.mode, asker?.voice || '', preface)

  useEffect(() => {
    if (questionText && !voice.voiceOn) boxRef.current?.focus()
  }, [questionText, voice.voiceOn])

  // Runs one backend call, shows what is happening, and keeps the updated panel.
  async function run(kind, call) {
    setBusy(kind)
    setError('')
    try {
      const next = await call()
      setPanel(next)
      return next
    } catch (err) {
      if (err.status >= 500 && err.status < 502) {
        setError("That step didn't finish (the AI may be unavailable). Your answer is saved, so press Try again.")
      } else {
        setError(err.message)
      }
      return null
    } finally {
      setBusy('')
    }
  }

  async function submit() {
    const text = answer.trim()
    if (!text || busy) return
    setSteps([])
    const next = await run('answering', () => answerPanelLive(id, text, onStep))
    if (next) setAnswer('')
  }

  // One live message. The panelists' steps run at the same time, so each finish is matched by its id.
  function onStep(name, data) {
    if (name === 'start') setSteps((current) => [...current, { id: data.id, node: data.node, who: data.who, done: false }])
    if (name === 'finish') setSteps((current) => current.map((step) => (step.id === data.id ? { ...step, done: true } : step)))
  }

  async function retry() {
    const before = questionText
    const next = await run('retrying', () => retryPanel(id))
    if (next && next.question?.question !== before) setAnswer('')
  }

  function end() {
    setConfirmEnd(false)
    run('ending', () => endPanel(id))
  }

  async function toggleMic() {
    if (voice.mode === 'listening') {
      const spoken = await voice.stopListening()
      if (spoken) setAnswer((previous) => (previous.trim() ? `${previous.trim()} ${spoken}` : spoken))
      boxRef.current?.focus()
    } else {
      voice.startListening()
    }
  }

  if (missing) {
    return (
      <div className="page interview-page">
        <div className="card center-card">
          <h2>Panel interview not found</h2>
          <p className="muted">It may have been deleted.</p>
          <a className="button-link primary" href="#/panel">
            Start a new panel
          </a>
        </div>
      </div>
    )
  }

  if (!panel) {
    return (
      <div className="page interview-page">
        <div className="card center-card">
          {error ? (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <SpiderLoader label="Loading the panel…" />
          )}
        </div>
      </div>
    )
  }

  if (panel.status === 'finished') return <PanelReport panel={panel} />

  const screen = voice.voiceOn ? (
    <PanelCall
      panel={panel}
      voice={voice}
      answer={answer}
      setAnswer={setAnswer}
      busy={busy}
      steps={busy === 'answering' ? steps : []}
      error={error}
      onSubmit={submit}
      onMic={toggleMic}
      onRetry={retry}
      onEnd={() => setConfirmEnd(true)}
    />
  ) : (
    <PanelRoom
      panel={panel}
      answer={answer}
      setAnswer={setAnswer}
      boxRef={boxRef}
      busy={busy}
      busyText={BUSY_TEXT[busy]}
      steps={busy === 'answering' ? steps : []}
      error={error}
      voice={voice}
      onSubmit={submit}
      onMic={toggleMic}
      onRetry={retry}
      onEnd={() => setConfirmEnd(true)}
    />
  )

  return (
    <>
      {screen}
      <ConfirmDialog
        open={confirmEnd}
        icon="flag"
        title="End the panel interview now?"
        text={
          panel.answered === 0
            ? "You haven't answered anything yet, so there is nothing to decide on."
            : 'Each panelist decides on what you answered so far, and you get the report.'
        }
        confirmLabel="End and see the decision"
        danger
        onConfirm={end}
        onCancel={() => setConfirmEnd(false)}
      />
    </>
  )
}

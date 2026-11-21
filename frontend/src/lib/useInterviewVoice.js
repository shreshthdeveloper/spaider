// Everything voice-related on the interview screen, in one hook:
// the interviewer reads each new question aloud, and you can answer with the microphone.
import { useEffect, useRef, useState } from 'react'
import { transcribeAnswer } from './api'
import { speak, startRecording, stopSpeaking } from './voice'

// interviewMode is the mode chosen when the interview was created: 'voice' or 'text'.
// The Voice on/off button in the header can still change it during the interview.
export function useInterviewVoice(questionText, interviewMode) {
  const [choice, setChoice] = useState(null) // null = follow the interview's mode
  const voiceOn = choice ?? interviewMode === 'voice'
  const [mode, setMode] = useState('idle') // 'idle' | 'speaking' | 'listening' | 'transcribing'
  const [level, setLevel] = useState(0) // loudness 0..1, for the orb
  const [seconds, setSeconds] = useState(0) // how long you have been recording
  const [needsClick, setNeedsClick] = useState(false) // the browser blocked sound until you click
  const [voiceError, setVoiceError] = useState('')
  // For the captions (SpokenCaption): what is being said, when the sound started and how long it lasts
  // (startedAt is null while the voice loads), and the last line that was said to the end (or stopped).
  const [speech, setSpeech] = useState(null) // { text, startedAt, durationMs }
  const [said, setSaid] = useState('')
  const recorderRef = useRef(null)

  async function say(text) {
    setSpeech({ text, startedAt: null, durationMs: 0 })
    function started(durationMs) {
      setNeedsClick(false)
      setSpeech({ text, startedAt: performance.now(), durationMs })
      setMode('speaking') // only once the sound really starts, not while it is loading
    }
    try {
      await speak(text, setLevel, started)
    } catch (error) {
      if (error?.name === 'NotAllowedError') setNeedsClick(true)
    } finally {
      setMode((current) => (current === 'speaking' ? 'idle' : current))
      setSpeech((current) => (current?.text === text ? null : current)) // unless a newer line has started
      setSaid(text)
    }
  }

  // Read each new question aloud. Playing audio is outside React, which is what effects are for;
  // say() only changes state later, once the sound starts or ends.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (voiceOn && questionText) say(questionText)
    return () => stopSpeaking()
  }, [questionText, voiceOn])

  // Count the seconds while recording.
  useEffect(() => {
    if (mode !== 'listening') return
    const startedAt = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
    return () => clearInterval(timer)
  }, [mode])

  // Stop everything when leaving the page.
  useEffect(() => {
    return () => {
      stopSpeaking()
      recorderRef.current?.cancel()
    }
  }, [])

  function toggleVoice() {
    const next = !voiceOn
    setChoice(next)
    if (!next) stopSpeaking()
  }

  async function startListening() {
    stopSpeaking()
    setVoiceError('')
    setSeconds(0)
    try {
      recorderRef.current = await startRecording(setLevel)
      setMode('listening')
    } catch {
      setVoiceError('The microphone is not available. Allow mic access in the browser, or type your answer.')
    }
  }

  // Stops recording and returns the words you said ('' if nothing could be turned into text).
  async function stopListening() {
    const recorder = recorderRef.current
    if (!recorder) return ''
    recorderRef.current = null
    setMode('transcribing')
    try {
      const audio = await recorder.stop()
      const result = await transcribeAnswer(audio, questionText)
      return result.text
    } catch (error) {
      setVoiceError(`Could not turn your speech into text (${error.message}). You can type your answer.`)
      return ''
    } finally {
      setMode('idle')
    }
  }

  return {
    voiceOn,
    toggleVoice,
    mode,
    level,
    seconds,
    needsClick,
    voiceError,
    speech,
    said,
    replay: () => say(questionText),
    startListening,
    stopListening,
  }
}

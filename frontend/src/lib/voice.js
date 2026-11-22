// Low-level voice helpers (no React here):
//   speak(text)        plays the interviewer's voice; the browser's own voice is the fallback
//   startRecording()   records your answer from the microphone
// Both report how loud the sound is (0 to 1) so the orb can move with it.
// When the 3D interviewer is on screen, speak() hands the voice to it instead, so its lips move with the words.
import { requestSpeech } from './api'
import { estimateMs } from './captions'

let audioContext = null

export function getAudioContext() {
  if (!audioContext) audioContext = new AudioContext()
  return audioContext
}

// Measures the loudness of a sound source about 60 times a second.
function watchLevel(source, onLevel) {
  const analyser = getAudioContext().createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const samples = new Uint8Array(analyser.fftSize)
  let running = true

  function tick() {
    if (!running) return
    analyser.getByteTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) {
      const value = (sample - 128) / 128
      sum += value * value
    }
    onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4))
    requestAnimationFrame(tick)
  }
  tick()

  return {
    stop() {
      running = false
      onLevel(0)
    },
  }
}

// ---------------------------------------------------------------- speaking

let playing = null // whatever is speaking right now: { stop() }
let latest = 0 // goes up on every speak() and stopSpeaking(), so a speak() that is still loading knows it was cancelled

export function stopSpeaking() {
  latest += 1
  if (playing) playing.stop()
  playing = null
}

// The 3D interviewer, if one is on screen. It is a promise because the model takes a few seconds to load,
// and the first question should already move its lips. It resolves to null if the model could not load.
let avatarPromise = null

export function setSpeakingAvatar(promise) {
  avatarPromise = promise
}

function waitForAvatar() {
  if (!avatarPromise) return Promise.resolve(null)
  const giveUp = new Promise((resolve) => setTimeout(() => resolve(null), 15000))
  return Promise.race([avatarPromise, giveUp])
}

// Plays `text` in the interviewer's voice and resolves when it has finished (or was stopped).
// onStart(ms) is called when the sound actually begins, with how long it lasts (so captions can keep pace). Rejects with a NotAllowedError
// if the browser wants a click before it plays sound. voiceName: a panelist's voice ('' = Bella's).
export async function speak(text, onLevel = () => {}, onStart = () => {}, voiceName = '') {
  stopSpeaking()
  const id = latest

  // Fetch the voice and wait for the 3D interviewer at the same time.
  // If the OpenAI voice is not available, audio is null and the browser's own voice is used.
  const [audio, avatar] = await Promise.all([requestSpeech(text, voiceName).catch(() => null), waitForAvatar()])
  if (id !== latest) return // stopped, or a newer question came, while we were loading

  if (audio && avatar) return speakWithAvatar(avatar, audio, text, onStart, id)
  if (audio) return playAudio(audio, text, onLevel, onStart)
  return speakWithBrowser(text, onLevel, onStart, avatar)
}

// The 3D interviewer plays the MP3 itself and moves its lips with it.
async function speakWithAvatar(avatar, blob, text, onStart, id) {
  const context = getAudioContext()
  const shortWait = new Promise((resolve) => setTimeout(resolve, 300))
  await Promise.race([context.resume(), shortWait]) // resume() never settles until the page has had a click
  if (context.state !== 'running') throw new DOMException('The browser wants a click before playing sound', 'NotAllowedError')
  if (id !== latest) return

  playing = { stop: () => avatar.stop() }
  await avatar.speak(await blob.arrayBuffer(), text, onStart)
}

function playAudio(blob, text, onLevel, onStart) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const element = new Audio(url)
    const context = getAudioContext()
    const source = context.createMediaElementSource(element)
    source.connect(context.destination)
    const meter = watchLevel(source, onLevel)

    function finish() {
      meter.stop()
      URL.revokeObjectURL(url)
      resolve()
    }

    element.onended = finish
    playing = {
      stop() {
        element.pause()
        finish()
      },
    }
    context
      .resume()
      .then(() => element.play())
      .then(() => onStart(Number.isFinite(element.duration) ? element.duration * 1000 : estimateMs(text)))
      .catch((error) => {
        meter.stop()
        URL.revokeObjectURL(url)
        playing = null
        reject(error)
      })
  })
}

function speakWithBrowser(text, onLevel, onStart, avatar) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve()
      return
    }
    // The browser does not say how loud it is, so the orb just pulses gently while it talks.
    let t = 0
    const timer = setInterval(() => {
      t += 0.25
      onLevel(0.35 + 0.25 * Math.abs(Math.sin(t)))
    }, 60)

    function finish() {
      clearInterval(timer)
      onLevel(0)
      resolve()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onstart = () => {
      onStart(estimateMs(text)) // the browser does not say how long it will take, so estimate
      avatar?.mimic(text) // the browser's voice gives us no audio, so the lips move on their own timing
    }
    utterance.onend = finish
    utterance.onerror = finish
    playing = {
      stop() {
        window.speechSynthesis.cancel()
        avatar?.stop()
        finish()
      },
    }
    window.speechSynthesis.speak(utterance)
  })
}

// ---------------------------------------------------------------- recording

// Starts recording from the microphone. Returns { stop(): Promise<Blob>, cancel() }.
export async function startRecording(onLevel = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const context = getAudioContext()
  await context.resume()

  const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
  const chunks = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  const meter = watchLevel(context.createMediaStreamSource(stream), onLevel)
  recorder.start()

  function release() {
    meter.stop()
    stream.getTracks().forEach((track) => track.stop()) // turns the browser's mic light off
  }

  return {
    stop() {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: recorder.mimeType || type }))
        }
        recorder.stop()
      })
    },
    cancel() {
      recorder.onstop = release
      recorder.stop()
    },
  }
}

// The human 3D interviewer in voice mode: a model that talks with lip-sync and reacts while you answer.
// It uses TalkingHead (MIT, src/vendor/talkinghead) on top of three.js.
// The model is public/avatars/mpfb.glb, which is CC0 (see the LICENSE.md next to it).
//
// No React here. createAvatar(box, audioContext) loads the model into the box and resolves with:
//   speak(mp3, text, onStart)  plays the MP3 (an ArrayBuffer) and moves the lips; onStart(ms) when the sound
//                              starts, with how long it lasts; resolves when it has finished
//   mimic(text)         moves the lips without sound (while the browser's own voice speaks)
//   stop()              stops talking
//   setMode(mode)       'idle' | 'speaking' | 'listening' | 'transcribing' | 'thinking'
//   setMicLevel(level)  while you talk, it nods now and then at your pauses
//   dispose()
import { LipsyncEn } from '../vendor/talkinghead/lipsync-en.mjs'
import { estimateMs, wordTimings } from './captions'
import { TalkingHead } from '../vendor/talkinghead/talkinghead.mjs'

const MODEL = {
  url: '/avatars/mpfb.glb',
  body: 'F',
  outfitMaterial: 'Human.female_casualsuit01', // repainted in a plain colour that fits the app
  outfitColor: '#22545a',
}

// Soft office light, like a video call: a warm key light, a soft fill and a cool rim light.
const LIGHTING = {
  lightAmbientColor: 0xfff1e0,
  lightAmbientIntensity: 0.7,
  lightDirectColor: 0xfff0dd,
  lightDirectIntensity: 8,
  lightDirectPhi: 1.1,
  lightDirectTheta: 1.0,
  lightSpotColor: 0xccd8ff,
  lightSpotIntensity: 4,
  lightSpotPhi: 0.4,
  lightSpotTheta: 4.0,
  lightSpotDispersion: 0.9,
}

// Small movements a real interviewer makes. dt = how long each step takes (ms), vs = face and head values.
// [a, b] means a random value between a and b.
const EXPRESSIONS = {
  nod: { dt: [[190, 260], [280, 380]], vs: { headMove: [0], headRotateX: [[0.09, 0.12], 0] } },
  ask: {
    dt: [280, [1300, 1900]],
    vs: { browInnerUp: [[0.22, 0.34]], browOuterUpLeft: [0.12], browOuterUpRight: [0.12], headRotateZ: [[-0.045, 0.045]] },
  },
  think: {
    dt: [420, [1100, 1700], 450],
    vs: { browInnerUp: [0.18, 0.18, 0], mouthPressLeft: [0.25, 0.25, 0], mouthPressRight: [0.25, 0.25, 0], headRotateY: [0.05, 0.05, 0] },
  },
}

export async function createAvatar(box, audioContext) {
  const head = new TalkingHead(box, {
    ttsEndpoint: '', // we bring our own voice (OpenAI), so TalkingHead needs no speech service
    lipsyncModules: [], // English lip-sync is added below: a bundler cannot follow TalkingHead's own dynamic import
    lipsyncLang: 'en',
    audioCtx: audioContext, // the same audio context as the rest of the app, so one click unlocks sound for both
    cameraView: 'upper',
    cameraDistance: -1.2,
    cameraY: -0.2,
    cameraRotateEnable: false,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    modelFPS: 30,
    avatarMood: 'neutral',
    avatarIdleEyeContact: 0.6,
    avatarIdleHeadMove: 0.45,
    avatarSpeakingEyeContact: 0.8,
    avatarSpeakingHeadMove: 0.55,
    avatarListeningEyeContact: 0.9,
    ...LIGHTING,
  })
  head.lipsync.en = new LipsyncEn()

  try {
    await head.showAvatar({ url: MODEL.url, body: MODEL.body, avatarMood: 'neutral', lipsyncLang: 'en' })
  } catch (error) {
    head.dispose()
    throw error
  }
  repaintOutfit(head)
  head.setBaselineValue('mouthSmile', 0.04) // a slight, friendly resting face

  let mode = 'idle'
  let disposed = false
  let finishTalking = null // ends the wait in speak(): true = finished, false = stopped
  let talkTimer = null

  function express(name) {
    try {
      head.animQueue.push(head.animFactory(EXPRESSIONS[name]))
    } catch {
      // only a nicety; never break the interview for it
    }
  }

  // Like a person on a video call: mostly looking at you, with short glances away.
  const gaze = setInterval(() => {
    if (mode === 'thinking') head.lookAhead(1800)
    else if (Math.random() < 0.85) head.makeEyeContact(3500)
  }, 3000)

  function stop() {
    try {
      head.stopSpeaking()
    } catch {
      // nothing was playing
    }
    clearTimeout(talkTimer)
    if (finishTalking) finishTalking(false)
    finishTalking = null
  }

  async function speak(mp3, text, onStart = () => {}) {
    if (disposed) return
    stop()
    const audio = await audioContext.decodeAudioData(mp3)
    const totalMs = audio.duration * 1000
    head.speakAudio({ audio, ...wordTimings(text, totalMs) })
    onStart(totalMs)

    const finished = await new Promise((resolve) => {
      finishTalking = resolve
      talkTimer = setTimeout(() => resolve(true), totalMs + 250)
    })
    finishTalking = null
    if (finished && !disposed && text.trim().endsWith('?')) express('ask') // brows up: "over to you"
  }

  function mimic(text) {
    if (disposed) return
    const seconds = estimateMs(text) / 1000
    const rate = audioContext.sampleRate
    const silence = audioContext.createBuffer(1, Math.floor(rate * seconds), rate)
    head.speakAudio({ audio: silence, ...wordTimings(text, seconds * 1000) })
  }

  function setMode(next) {
    if (disposed) return
    const before = mode
    mode = next === 'transcribing' ? 'thinking' : next
    try {
      if (mode === 'listening') head.makeEyeContact(6000)
      if (mode === 'idle') head.makeEyeContact(1500)
      if (mode === 'thinking' && before !== 'thinking') {
        head.lookAhead(2500)
        express('think')
      }
    } catch {
      // only a nicety
    }
  }

  // While you speak: a small nod at a natural pause, the way people show they are following.
  let talkingSince = null
  let lastLoud = 0
  let lastNod = 0
  function setMicLevel(level) {
    if (mode !== 'listening') {
      talkingSince = null
      return
    }
    const now = performance.now()
    if (level > 0.12) {
      if (!talkingSince) talkingSince = now
      lastLoud = now
    } else if (talkingSince && now - lastLoud > 420 && now - talkingSince > 1800 && now - lastNod > 4200) {
      lastNod = now
      talkingSince = null
      if (Math.random() < 0.7) express('nod')
    }
  }

  function dispose() {
    disposed = true
    clearInterval(gaze)
    stop()
    try {
      head.stop()
      head.dispose()
    } catch {
      // already gone
    }
  }

  return { speak, mimic, stop, setMode, setMicLevel, dispose }
}

// Paint the outfit one plain colour (the sample model's clothes have a busy texture).
function repaintOutfit(head) {
  const root = head.armature || head.scene
  root?.traverse((object) => {
    if (!object.isMesh || object.material?.name !== MODEL.outfitMaterial) return
    const material = object.material.clone()
    material.map = null
    material.color.set(MODEL.outfitColor)
    material.roughness = 0.85
    material.needsUpdate = true
    object.material = material
  })
}

import { useEffect, useRef, useState } from 'react'
import { getAudioContext, setSpeakingAvatar } from '../../lib/voice'
import { canDraw3D } from '../../lib/webgl'
import SpiderLoader from '../SpiderLoader'
import VoiceOrb from './VoiceOrb'

// The human 3D interviewer (lib/avatar.js), filling the call screen.
// The model takes a few seconds to load, so until then it says "<name> is joining…", like a call
// that is connecting. If 3D is not possible, a simple animated orb stands in.
export default function InterviewerAvatar({ mode, level, name }) {
  const boxRef = useRef(null)
  const avatarRef = useRef(null)
  const [status, setStatus] = useState(() => (canDraw3D() ? 'loading' : 'failed')) // 'loading' | 'ready' | 'failed'

  useEffect(() => {
    if (!canDraw3D()) return

    // Each load draws into its own holder, so a load that finishes late can never touch the next one.
    const holder = document.createElement('div')
    holder.className = 'avatar-holder'
    boxRef.current.appendChild(holder)
    let gone = false

    // lib/avatar.js (TalkingHead + three.js) is downloaded only now.
    const loading = import('../../lib/avatar')
      .then(({ createAvatar }) => createAvatar(holder, getAudioContext()))
      .then((avatar) => {
        if (gone) {
          avatar.dispose()
          return null
        }
        avatarRef.current = avatar
        setStatus('ready')
        return avatar
      })
      .catch(() => {
        if (!gone) setStatus('failed')
        return null
      })

    // Speech waits for this, so even the first question moves the lips.
    setSpeakingAvatar(loading)

    return () => {
      gone = true
      setSpeakingAvatar(null)
      avatarRef.current?.dispose()
      avatarRef.current = null
      holder.remove()
    }
  }, [])

  // status is listed so the avatar gets the current mode as soon as it is ready.
  useEffect(() => {
    avatarRef.current?.setMode(mode)
  }, [mode, status])

  useEffect(() => {
    avatarRef.current?.setMicLevel(level)
  }, [level])

  return (
    <div className="avatar-host">
      <div ref={boxRef} className={`avatar-canvas${status === 'ready' ? ' ready' : ''}`} />
      {status === 'loading' && (
        <div className="avatar-joining">
          <SpiderLoader label={`${name} is joining…`} />
        </div>
      )}
      {status === 'failed' && (
        <div className="avatar-fallback">
          <VoiceOrb mode={mode} level={level} size={170} />
        </div>
      )}
    </div>
  )
}

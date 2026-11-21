import { useEffect, useState } from 'react'
import SpiderLoader from './SpiderLoader'

const SHOW_MS = 1500 // how long the splash stays every time the app is opened or refreshed
const FADE_MS = 350 // then it fades away

// The spider, the name and the tagline, for a moment after each refresh.
// The app loads underneath at the same time, so the splash never makes anything slower.
export default function SplashScreen() {
  const [stage, setStage] = useState('showing') // 'showing' | 'leaving' | 'gone'

  useEffect(() => {
    const leave = setTimeout(() => setStage('leaving'), SHOW_MS)
    const gone = setTimeout(() => setStage('gone'), SHOW_MS + FADE_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(gone)
    }
  }, [])

  if (stage === 'gone') return null

  return (
    <div className={`splash${stage === 'leaving' ? ' leaving' : ''}`}>
      <SpiderLoader size="large" />
      <div className="splash-name">
        Sp<span className="brand-ai">AI</span>der
      </div>
      <div className="splash-tagline">Catches your weak spots before the interviewer does</div>
    </div>
  )
}

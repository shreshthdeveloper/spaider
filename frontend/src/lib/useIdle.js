import { useEffect, useState } from 'react'

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']

// True once you haven't moved the mouse, typed or scrolled for `ms` while this tab is open.
// It only watches; it never stops or interrupts anything.
export function useIdle(ms) {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let last = Date.now()

    function onActivity() {
      last = Date.now()
      setIdle(false) // React skips the update when it is already false
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last > ms) setIdle(true)
    }, 5000)
    // capture: true also catches scrolling inside boxes (a scroll event doesn't bubble up)
    ACTIVITY.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }))
    return () => {
      clearInterval(timer)
      ACTIVITY.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }))
    }
  }, [ms])

  return idle
}

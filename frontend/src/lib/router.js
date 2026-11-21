// A tiny hash router: #/interview, #/interview/<id>, #/bank, #/docs... (no hash = #/interview).
// Hash routes need no server setup, so a page refresh always works.
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

// "#/interview/abc123" -> { page: "interview", arg: "abc123" }
function readRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('?')[0].split('/')
  return { page: parts[0] || 'interview', arg: parts[1] || '' }
}

export function useRoute() {
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    // Moving to another page: the page content fades and rises a little (View Transitions API, see
    // "page transitions" in shell.css). Browsers without it, or with "reduce motion" on, just switch.
    function onChange() {
      const next = readRoute()
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!document.startViewTransition || calm) {
        setRoute(next)
        return
      }
      const root = document.documentElement
      root.classList.add('page-switching')
      const transition = document.startViewTransition(() => flushSync(() => setRoute(next)))
      transition.finished.finally(() => root.classList.remove('page-switching'))
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

// Move to another page from code, e.g. go("interview/abc123").
export function go(path) {
  window.location.hash = `#/${path}`
}

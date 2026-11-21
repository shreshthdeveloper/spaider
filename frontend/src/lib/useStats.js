import { useEffect, useRef, useState } from 'react'
import { getStats } from './api'

const EVERY_MS = 5 * 60 * 1000 // also reload now and then, so a new day is noticed

// Loads /api/stats, and loads it again after anything you do (lib/api.js sends "recent-changed"
// after each chat message, answer and finished round) and when you come back to this tab.
//   stats   the data, or null until it first loads
//   failed  true if the last load failed (e.g. the backend is down); stats keeps the last good data
//   gained  goes up by one each time today's count goes up, e.g. you just finished a round.
//           Used as a React key, it replays the spider's "well done" animation.
export function useStats() {
  const [stats, setStats] = useState(null)
  const [gained, setGained] = useState(0)
  const [failed, setFailed] = useState(false)
  const todayCount = useRef(null) // today's count at the last load

  useEffect(() => {
    let alive = true
    let soon = null

    function load() {
      getStats()
        .then((data) => {
          if (!alive) return
          const before = todayCount.current
          todayCount.current = data.streak.today_count
          if (before !== null && data.streak.today_count > before) setGained((n) => n + 1)
          setStats(data)
          setFailed(false)
        })
        .catch(() => alive && setFailed(true))
    }

    // one action can send several events, so wait a moment and load once
    function loadSoon() {
      clearTimeout(soon)
      soon = setTimeout(load, 800)
    }

    function onVisible() {
      if (document.visibilityState === 'visible') loadSoon()
    }

    load()
    const timer = setInterval(load, EVERY_MS)
    window.addEventListener('recent-changed', loadSoon)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(soon)
      clearInterval(timer)
      window.removeEventListener('recent-changed', loadSoon)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { stats, gained, failed }
}

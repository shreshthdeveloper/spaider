import { flushSync } from 'react-dom'
import { useEffect, useState } from 'react'

// The colour theme. You choose 'light', 'dark' or 'system' (follow the computer); it is remembered in
// this browser. The page itself is always 'light' or 'dark': <html data-theme="..."> picks the token
// values in styles/tokens.css. index.html runs the same rule before the first paint.
const KEY = 'spaider-theme'
const CHOICES = ['light', 'dark', 'system']

export function savedChoice() {
  try {
    const choice = localStorage.getItem(KEY)
    return CHOICES.includes(choice) ? choice : 'system'
  } catch {
    return 'system'
  }
}

function computerIsDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolve(choice) {
  if (choice === 'system') return computerIsDark() ? 'dark' : 'light'
  return choice
}

// Changes the theme. With from = { x, y } (where you clicked), the new colours spread out from there
// in a circle (View Transitions API); browsers without it just switch.
export function setThemeChoice(choice, from) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // private mode: it just won't be remembered
  }
  const apply = () => {
    document.documentElement.dataset.theme = resolve(choice)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: choice }))
  }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || calm || !from) {
    apply()
    return
  }
  const root = document.documentElement
  root.style.setProperty('--reveal-x', `${from.x}px`)
  root.style.setProperty('--reveal-y', `${from.y}px`)
  root.classList.add('theme-switching')
  const transition = document.startViewTransition(() => flushSync(apply))
  transition.finished.finally(() => root.classList.remove('theme-switching'))
}

// { choice, theme }: what you picked, and what the page shows now. Follows the computer when on 'system'.
export function useTheme() {
  const [choice, setChoice] = useState(savedChoice)
  const [theme, setTheme] = useState(() => resolve(savedChoice()))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function onChoice(e) {
      setChoice(e.detail)
      setTheme(resolve(e.detail))
    }
    function onComputer() {
      if (savedChoice() !== 'system') return
      document.documentElement.dataset.theme = resolve('system')
      setTheme(resolve('system'))
    }
    window.addEventListener('theme-changed', onChoice)
    media.addEventListener('change', onComputer)
    return () => {
      window.removeEventListener('theme-changed', onChoice)
      media.removeEventListener('change', onComputer)
    }
  }, [])

  return { choice, theme }
}

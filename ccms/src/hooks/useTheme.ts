import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('ccms-theme') as Theme) ?? 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('ccms-theme', theme)
  }, [theme])

  // Apply saved theme on initial mount without waiting for render
  useEffect(() => {
    const saved = localStorage.getItem('ccms-theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])

  function toggleTheme() {
    setTheme(t => (t === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme }
}

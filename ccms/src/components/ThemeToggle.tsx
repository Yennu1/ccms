import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        color: '#9CA3AF',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 6,
        transition: 'color 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
      onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}

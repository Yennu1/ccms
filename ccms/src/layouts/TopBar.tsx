import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Members',
  '/settings': 'Settings',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] ?? 'Centry CMS'

  return (
    <header style={{
      height: 52,
      background: '#fff',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      {/* Page title */}
      <span style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: 16,
        color: '#111827',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </span>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search */}
        <button style={{
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
          aria-label="Search"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Bell */}
        <button style={{
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
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2.5a5.5 5.5 0 0 0-5.5 5.5v3.5l-1.25 1.75A.75.75 0 0 0 3.87 14.5h12.26a.75.75 0 0 0 .62-1.25L15.5 11.5V8A5.5 5.5 0 0 0 10 2.5Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"
            />
            <path d="M8 14.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>

        {/* Avatar */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#4F6BED',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
        }}>
          <span style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 12,
            color: '#fff',
          }}>
            {user?.full_name ? getInitials(user.full_name) : '?'}
          </span>
        </div>
      </div>
    </header>
  )
}

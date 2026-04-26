import { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Members',
    path: '/members',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" fill="currentColor" />
        <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path
          d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
        />
      </svg>
    ),
  },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Sidebar() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

const handleSignOut = async () => {
  try {
    // Clear ALL auth keys including the new ccms-auth-token
    localStorage.removeItem('ccms-auth-token')
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    })
    await supabase.auth.signOut()
    window.location.href = '/login'
  } catch {
    localStorage.removeItem('ccms-auth-token')
    window.location.href = '/login'
  }
}

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      height: '100vh',
      background: '#1B2352',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 40,
    }}>

      {/* Brand */}
      <div style={{
        padding: '20px 16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <polygon
            points="13,1.2 24,7.35 24,19.65 13,25.8 2,19.65 2,7.35"
            fill="none" stroke="white" strokeWidth="1.4" strokeOpacity="0.9"
          />
          <circle cx="13" cy="13" r="2.5" fill="white" fillOpacity="0.9" />
        </svg>
        <span style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 15,
          color: '#fff',
          letterSpacing: '-0.01em',
        }}>
          Centry CMS
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 40,
                paddingLeft: active ? 14 : 16,
                paddingRight: 16,
                marginBottom: 2,
                borderRadius: active ? '0 8px 8px 0' : 8,
                marginRight: active ? 8 : 8,
                marginLeft: active ? 0 : 0,
                borderLeft: active ? '2px solid #4F6BED' : '2px solid transparent',
                background: active ? 'rgba(79,107,237,0.25)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500,
                fontSize: 13,
                textDecoration: 'none',
                transition: 'all 0.12s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'rgba(255,255,255,0.06)'
                  el.style.color = 'rgba(255,255,255,0.9)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'transparent'
                  el.style.color = 'rgba(255,255,255,0.6)'
                }
              }}
            >
              <span style={{
                color: active ? '#7B93F5' : 'rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'color 0.12s ease',
              }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info (bottom) */}
      <div style={{
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        padding: '12px 16px',
        position: 'relative',
      }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            borderRadius: 8,
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#4F6BED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
          {/* Name + role */}
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 13,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.full_name ?? 'User'}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'capitalize',
            }}>
              {user?.role?.replace('_', ' ') ?? 'Member'}
            </div>
          </div>
          {/* Chevron */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 12,
            right: 12,
            marginBottom: 6,
            background: '#fff',
            borderRadius: 8,
            border: '0.5px solid #E5E7EB',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13,
                color: '#EF4444',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 12H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M9.5 9.5L12 7l-2.5-2.5M12 7H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSidebar } from '../contexts/SidebarContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

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
        <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    label: 'Donations',
    path: '/donations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v12M5 4.5h4.5a2 2 0 0 1 0 4H5v-4ZM5 8.5h5a2 2 0 0 1 0 4H5V8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    label: 'Events',
    path: '/events',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M1.5 6.5h13M5 1.5V4M11 1.5V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Groups',
    path: '/groups',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5.5" r="2.5" fill="currentColor" />
        <circle cx="10.5" cy="5.5" r="2.5" fill="currentColor" opacity="0.5" />
        <path d="M1 13c0-2.485 2.015-4 4.5-4s4.5 1.515 4.5 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
        <path d="M10.5 9.5c1.93.32 3.5 1.67 3.5 3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 12V7M6.5 12V4M10 12V9M13.5 12V6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path
          d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        />
      </svg>
    ),
  },
]

const ROLE_LABELS: Record<string, string> = {
  super_admin:      'Super Admin',
  admin:            'Branch Admin',
  finance_officer:  'Finance Officer',
  group_leader:     'Group Leader',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="11" cy="7" r="1.25" fill="currentColor" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile, isMobile } = useSidebar()
  const { openSettings } = useSettings()

  // Icons-only rail: collapsed, but only on desktop (on mobile it's a full drawer)
  const iconOnly = collapsed && !isMobile

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [userCardHovered, setUserCardHovered] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [branchName, setBranchName] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Active member count badge
  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', user.org_id)
      .eq('membership_status', 'active')
      .then(({ count }) => { if (count !== null) setMemberCount(count) })
  }, [user?.org_id])

  // Branch name for user card subtitle
  useEffect(() => {
    if (!user) return
    if (user.branch_id) {
      supabase
        .from('branches')
        .select('name')
        .eq('id', user.branch_id)
        .single()
        .then(({ data }) => { if (data) setBranchName(data.name) })
    } else {
      // Super admin — fall back to org name (hardcoded for now, dynamic in Sprint 8)
      setBranchName('Centry CMS')
    }
  }, [user?.branch_id])

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''
  const subtitle = [roleLabel, branchName].filter(Boolean).join(' · ')

  const sidebarStyle: CSSProperties = {
    width: iconOnly ? 60 : 220,
    minWidth: iconOnly ? 60 : 220,
    height: '100vh',
    background: '#1B2352',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: isMobile ? (mobileOpen ? 0 : -220) : 0,
    top: 0,
    zIndex: 50,
    transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  }

  return (
    <aside style={sidebarStyle}>

      {/* Brand */}
      <div style={{
        padding: iconOnly ? '20px 14px 18px' : '20px 16px 18px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: iconOnly ? 'center' : 'space-between',
          gap: iconOnly ? 0 : 10,
        }}>
          {/* Logo group — replaced by the toggle when collapsed */}
          {!iconOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
          )}

          {/* Sidebar collapse toggle — desktop only */}
          {!isMobile && (
            <button
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                <line x1="7" y1="3" x2="7" y2="15" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </button>
          )}
        </div>
        {/* Org/church name */}
        {!iconOnly && (
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em',
            marginTop: 6,
            marginLeft: 36,
          }}>
            HILLTOP
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 0 12px', overflowY: 'auto' }}>
        {/* WORKSPACE label */}
        {!iconOnly && (
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0 16px',
            marginBottom: 4,
          }}>
            Workspace
          </div>
        )}

        {NAV_ITEMS.map(item => {
          const isSettings = item.path === '/settings'
          const active = !isSettings && isActive(item.path)
          const isMembers = item.path === '/members'

          // Settings opens the modal; all other items are router Links
          if (isSettings) {
            return (
              <button
                key={item.path}
                title={iconOnly ? item.label : undefined}
                onClick={() => { openSettings('profile'); if (isMobile) closeMobile() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: iconOnly ? 'center' : 'flex-start',
                  gap: iconOnly ? 0 : 10,
                  height: 40,
                  width: '100%',
                  paddingLeft: iconOnly ? 0 : 16,
                  paddingRight: iconOnly ? 0 : 12,
                  marginBottom: 2,
                  borderRadius: 8,
                  borderLeft: '2px solid transparent',
                  borderRight: 'none',
                  borderTop: 'none',
                  borderBottom: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }}
              >
                <span style={{
                  color: 'rgba(255,255,255,0.4)',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  transition: 'color 0.12s ease',
                }}>
                  {item.icon}
                </span>
                {!iconOnly && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
              </button>
            )
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              title={iconOnly ? item.label : undefined}
              onClick={() => { if (isMobile) closeMobile() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: iconOnly ? 'center' : 'flex-start',
                gap: iconOnly ? 0 : 10,
                height: 40,
                paddingLeft: iconOnly ? 0 : active ? 14 : 16,
                paddingRight: iconOnly ? 0 : 12,
                marginBottom: 2,
                borderRadius: active ? '0 8px 8px 0' : 8,
                marginRight: 8,
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
              {!iconOnly && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
              {!iconOnly && isMembers && memberCount !== null && (
                <span style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: 10,
                  flexShrink: 0,
                  lineHeight: '16px',
                }}>
                  {memberCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User card (bottom) */}
      <div style={{
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        padding: '8px',
      }}>
        <div
          ref={dropdownRef}
          style={{ position: 'relative' }}
          onMouseEnter={() => setUserCardHovered(true)}
          onMouseLeave={() => setUserCardHovered(false)}
        >
          {/* Card surface */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: iconOnly ? 'center' : 'flex-start',
            gap: iconOnly ? 0 : 10,
            background: userCardHovered || dropdownOpen
              ? 'rgba(255,255,255,0.09)'
              : 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: iconOnly ? '8px 6px' : '8px 8px',
            transition: 'background 0.15s',
          }}>
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

            {/* Name + role · branch */}
            {!iconOnly && (
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {subtitle || '…'}
                </div>
              </div>
            )}

            {/* Three-dot button — hover only */}
            {!iconOnly && (
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderRadius: 4,
                flexShrink: 0,
                opacity: userCardHovered || dropdownOpen ? 1 : 0,
                transition: 'opacity 0.15s, background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              aria-label="User menu"
            >
              <DotsIcon />
            </button>
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--dm-bg-card)',
              borderRadius: 8,
              border: '0.5px solid var(--dm-border-soft)',
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
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
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
      </div>
    </aside>
  )
}

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Breadcrumb logic ─────────────────────────────────────────────────────────

interface BreadcrumbSegment {
  label: string
  isLast: boolean
}

function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  if (pathname === '/dashboard' || pathname === '/') {
    return [{ label: 'Dashboard', isLast: true }]
  }
  if (pathname === '/members') {
    return [{ label: 'Members', isLast: true }]
  }
  if (pathname === '/members/households') {
    return [
      { label: 'Members', isLast: false },
      { label: 'Households', isLast: true },
    ]
  }
  if (pathname === '/members/households/new') {
    return [
      { label: 'Members', isLast: false },
      { label: 'Households', isLast: false },
      { label: 'New Household', isLast: true },
    ]
  }
  if (/^\/members\/households\/[^/]+$/.test(pathname)) {
    return [
      { label: 'Members', isLast: false },
      { label: 'Households', isLast: false },
      { label: 'Household', isLast: true },
    ]
  }
  if (pathname === '/members/new') {
    return [
      { label: 'Members', isLast: false },
      { label: 'Add Member', isLast: true },
    ]
  }
  if (/^\/members\/[^/]+\/edit$/.test(pathname)) {
    return [
      { label: 'Members', isLast: false },
      { label: 'Edit Member', isLast: true },
    ]
  }
  if (/^\/members\/[^/]+$/.test(pathname)) {
    return [
      { label: 'Members', isLast: false },
      { label: 'Profile', isLast: true },
    ]
  }
  if (pathname === '/settings') {
    return [{ label: 'Settings', isLast: true }]
  }
  if (pathname === '/donations') {
    return [{ label: 'Donations', isLast: true }]
  }
  if (pathname === '/donations/new') {
    return [
      { label: 'Donations', isLast: false },
      { label: 'Record Giving', isLast: true },
    ]
  }
  if (pathname === '/donations/pledges') {
    return [
      { label: 'Donations', isLast: false },
      { label: 'Pledges', isLast: true },
    ]
  }
  if (/^\/donations\/[^/]+$/.test(pathname)) {
    return [
      { label: 'Donations', isLast: false },
      { label: 'Transaction', isLast: true },
    ]
  }
  if (pathname === '/events') {
    return [{ label: 'Events', isLast: true }]
  }
  if (pathname === '/groups') {
    return [{ label: 'Groups', isLast: true }]
  }
  if (pathname === '/reports') {
    return [{ label: 'Reports', isLast: true }]
  }
  return [{ label: 'Centry CMS', isLast: true }]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [orgName, setOrgName] = useState('Centry CMS')

  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('organizations')
      .select('name')
      .eq('id', user.org_id)
      .single()
      .then(({ data }) => { if (data?.name) setOrgName(data.name) })
  }, [user?.org_id])

  const breadcrumbs = getBreadcrumbs(pathname)

  return (
    <>
      <style>{`
        .topbar-search::placeholder { color: #9CA3AF; }
        .topbar-search:focus {
          border-color: #4F6BED !important;
          outline: none;
        }
        .topbar-icon-btn:hover { color: #4F6BED !important; }
      `}</style>

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

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 400,
            fontSize: 13,
            color: '#9CA3AF',
          }}>
            {orgName}
          </span>

          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                color: '#D1D5DB',
                margin: '0 6px',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13,
                userSelect: 'none',
              }}>
                /
              </span>
              <span style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: crumb.isLast ? 600 : 400,
                fontSize: 13,
                color: crumb.isLast ? '#111827' : '#9CA3AF',
              }}>
                {crumb.label}
              </span>
            </span>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg
              width="15" height="15" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none', flexShrink: 0 }}
            >
              <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-2.9-2.9" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className="topbar-search"
              type="text"
              placeholder="Search members, donations, events..."
              style={{
                width: 280,
                height: 34,
                borderRadius: 8,
                border: '0.5px solid #E5E7EB',
                background: '#F9FAFB',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13,
                color: '#111827',
                paddingLeft: 32,
                paddingRight: 40,
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              readOnly
            />
            <span style={{
              position: 'absolute',
              right: 10,
              pointerEvents: 'none',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: '#9CA3AF',
              letterSpacing: '0.02em',
            }}>
              ⌘K
            </span>
          </div>

          {/* Help icon */}
          <button
            className="topbar-icon-btn"
            title="Help"
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
            aria-label="Help"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 8c0-1.105.895-2 2-2s2 .895 2 2c0 .828-.503 1.541-1.25 1.854C10.311 10.05 10 10.49 10 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="10" cy="14" r="0.75" fill="currentColor" />
            </svg>
          </button>

          {/* Bell */}
          <button
            className="topbar-icon-btn"
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
        </div>
      </header>
    </>
  )
}

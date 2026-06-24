import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'

// ─── Breadcrumb logic ─────────────────────────────────────────────────────────

interface BreadcrumbSegment {
  label: string
  isLast: boolean
}

// ─── Search result types ──────────────────────────────────────────────────────

interface MemberResult {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
}

interface EventResult {
  id: string
  name: string
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
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('Centry CMS')

  // ─── Search state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState<string>('')
  const [members, setMembers] = useState<MemberResult[]>([])
  const [events, setEvents] = useState<EventResult[]>([])
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('organisations')
      .select('name')
      .eq('id', user.org_id)
      .maybeSingle()
      .then(({ data }) => { if (data?.name) setOrgName(data.name) })
  }, [user?.org_id])

  // ─── Debounced search ────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setMembers([])
      setEvents([])
      setOpen(false)
      return
    }
    if (!user?.org_id) return
    const orgId = user.org_id
    const like = `%${q}%`

    const handle = setTimeout(async () => {
      const [mRes, eRes] = await Promise.all([
        supabase
          .from('members')
          .select('id, first_name, last_name, member_number')
          .eq('org_id', orgId)
          .or(`first_name.ilike.${like},last_name.ilike.${like},member_number.ilike.${like}`)
          .limit(5),
        supabase
          .from('events')
          .select('id, name')
          .eq('org_id', orgId)
          .ilike('name', like)
          .limit(5),
      ])

      const m = (mRes.data ?? []) as MemberResult[]
      const ev = (eRes.data ?? []) as EventResult[]
      setMembers(m)
      setEvents(ev)
      setOpen(m.length > 0 || ev.length > 0)
    }, 300)

    return () => clearTimeout(handle)
  }, [query, user?.org_id])

  // ─── Close on outside click / Escape ─────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function goTo(path: string) {
    navigate(path)
    setQuery('')
    setOpen(false)
  }

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
        .topbar-search-result:hover { background: hsl(var(--muted)) !important; }
      `}</style>

      <header style={{
        height: 52,
        background: 'hsl(var(--card))',
        borderBottom: '0.5px solid hsl(var(--border))',
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
            color: 'hsl(var(--muted-foreground))',
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
                color: crumb.isLast ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              }}>
                {crumb.label}
              </span>
            </span>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Search */}
          <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg
              width="15" height="15" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none', flexShrink: 0, color: 'hsl(var(--muted-foreground))' }}
            >
              <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className="topbar-search"
              type="text"
              placeholder="Search members, events..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => {
                if (members.length > 0 || events.length > 0) setOpen(true)
              }}
              style={{
                width: 280,
                height: 34,
                borderRadius: 8,
                border: '0.5px solid hsl(var(--border))',
                background: 'hsl(var(--muted))',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13,
                color: 'hsl(var(--foreground))',
                paddingLeft: 32,
                paddingRight: 40,
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
            <span style={{
              position: 'absolute',
              right: 10,
              pointerEvents: 'none',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              letterSpacing: '0.02em',
            }}>
              ⌘K
            </span>

            {/* Results dropdown */}
            {open && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 280,
                maxHeight: 360,
                overflowY: 'auto',
                background: 'hsl(var(--card))',
                border: '0.5px solid hsl(var(--border))',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: 4,
                zIndex: 50,
              }}>
                {members.length > 0 && (
                  <>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'hsl(var(--muted-foreground))',
                      padding: '8px 8px 4px',
                    }}>
                      Members
                    </div>
                    {members.map(m => (
                      <button
                        key={m.id}
                        className="topbar-search-result"
                        onClick={() => goTo(`/members/${m.id}`)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: 6,
                          transition: 'background 0.12s',
                        }}
                      >
                        <span style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontSize: 13,
                          color: 'hsl(var(--foreground))',
                        }}>
                          {m.first_name} {m.last_name}
                        </span>
                        {m.member_number && (
                          <span style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 12,
                            color: 'hsl(var(--muted-foreground))',
                          }}>
                            {m.member_number}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {events.length > 0 && (
                  <>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'hsl(var(--muted-foreground))',
                      padding: '8px 8px 4px',
                    }}>
                      Events
                    </div>
                    {events.map(ev => (
                      <button
                        key={ev.id}
                        className="topbar-search-result"
                        onClick={() => goTo(`/events/${ev.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: 6,
                          transition: 'background 0.12s',
                        }}
                      >
                        <span style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontSize: 13,
                          color: 'hsl(var(--foreground))',
                        }}>
                          {ev.name}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

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

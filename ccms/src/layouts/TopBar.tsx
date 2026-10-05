import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSidebar } from '../contexts/SidebarContext'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'

// ─── Role labels (same as Sidebar) ────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  super_admin:      'Super Admin',
  admin:            'Branch Admin',
  finance_officer:  'Finance Officer',
  group_leader:     'Group Leader',
}

interface Branch {
  id: string
  name: string
}

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
    return [{ label: 'Finance', isLast: true }]
  }
  if (pathname === '/donations/new') {
    return [
      { label: 'Finance', isLast: false },
      { label: 'Record Giving', isLast: true },
    ]
  }
  if (pathname === '/donations/pledges') {
    return [
      { label: 'Finance', isLast: false },
      { label: 'Pledges', isLast: true },
    ]
  }
  if (pathname === '/donations/expenses') {
    return [
      { label: 'Finance', isLast: false },
      { label: 'Expenses', isLast: true },
    ]
  }
  if (pathname === '/donations/expenses/new') {
    return [
      { label: 'Finance', isLast: false },
      { label: 'Expenses', isLast: false },
      { label: 'Record Expense', isLast: true },
    ]
  }
  if (/^\/donations\/expenses\/[^/]+\/edit$/.test(pathname)) {
    return [
      { label: 'Finance', isLast: false },
      { label: 'Expenses', isLast: false },
      { label: 'Edit Expense', isLast: true },
    ]
  }
  if (/^\/donations\/[^/]+$/.test(pathname)) {
    return [
      { label: 'Finance', isLast: false },
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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { toggleMobile, isMobile } = useSidebar()
  const [orgName, setOrgName] = useState('Centry CMS')
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)

  // ─── Org dropdown state ─────────────────────────────────────────────────
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchName, setBranchName] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>(() => localStorage.getItem('dash_branch') ?? '')
  const [branchListOpen, setBranchListOpen] = useState(false)
  const orgDropdownRef = useRef<HTMLDivElement>(null)

  // ─── Search state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState<string>('')
  const [members, setMembers] = useState<MemberResult[]>([])
  const [events, setEvents] = useState<EventResult[]>([])
  const [open, setOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // ─── Fetch org info ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('organisations')
      .select('name, logo_url')
      .eq('id', user.org_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setOrgName(data.name)
        setOrgLogoUrl(data?.logo_url ?? null)
      })
  }, [user?.org_id])

  // Re-fetch org name when updated from settings
  useEffect(() => {
    const handler = () => {
      if (!user?.org_id) return
      supabase.from('organisations').select('name, logo_url')
        .eq('id', user.org_id).single()
        .then(({ data }) => {
          if (data) {
            setOrgName(data.name)
            setOrgLogoUrl(data.logo_url ?? null)
          }
        })
    }
    window.addEventListener('org-name-updated', handler)
    return () => window.removeEventListener('org-name-updated', handler)
  }, [user?.org_id])

  // ─── Fetch branches ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  // ─── Fetch user's branch name ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    if (user.branch_id) {
      supabase.from('branches').select('name').eq('id', user.branch_id).single()
        .then(({ data }) => { if (data) setBranchName(data.name) })
    } else {
      setBranchName('All branches')
    }
  }, [user?.branch_id])

  // ─── Close org dropdown on outside click / Escape ───────────────────────
  useEffect(() => {
    if (!orgDropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false)
        setBranchListOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOrgDropdownOpen(false)
        setBranchListOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [orgDropdownOpen])

  const handleBranchSwitch = useCallback((branchId: string) => {
    setSelectedBranch(branchId)
    localStorage.setItem('dash_branch', branchId)
    setOrgDropdownOpen(false)
    setBranchListOpen(false)
    window.dispatchEvent(new CustomEvent('branch-switched', { detail: branchId }))
  }, [])

  const handleSignOut = useCallback(async () => {
    setOrgDropdownOpen(false)
    await signOut()
    window.location.href = '/login'
  }, [signOut])

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

  // Leave mobile search mode when the viewport grows back to desktop
  useEffect(() => {
    if (!isMobile) setMobileSearchOpen(false)
  }, [isMobile])

  function goTo(path: string) {
    navigate(path)
    setQuery('')
    setOpen(false)
    setMobileSearchOpen(false)
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
        .org-dropdown-item:hover { background: hsl(var(--muted)) !important; }
        @keyframes orgDropFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header style={{
        height: 52,
        background: 'hsl(var(--card))',
        borderBottom: '0.5px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 24px',
        flexShrink: 0,
      }}>

        {/* Left: sidebar toggle + breadcrumb — hidden while mobile search is open */}
        {!(isMobile && mobileSearchOpen) && (
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          {isMobile && (
            <button
              onClick={toggleMobile}
              title="Open menu"
              aria-label="Open menu"
              style={{
                width: 40, height: 40, borderRadius: 8,
                border: '0.5px solid var(--dm-border)',
                background: 'var(--dm-bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--dm-text-secondary)',
                marginRight: 10, flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {isMobile ? (
            /* Mobile: current page title only — the org name + full trail don't fit */
            <span style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '-0.01em',
              color: 'hsl(var(--foreground))',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {breadcrumbs[breadcrumbs.length - 1]?.label}
            </span>
          ) : (
            <>
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
            </>
          )}
        </div>
        )}

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, flex: (isMobile && mobileSearchOpen) ? 1 : undefined, minWidth: 0 }}>

          {/* Search — collapses to an icon on mobile, expands to a full-width input */}
          {isMobile && !mobileSearchOpen && (
            <button
              className="topbar-icon-btn"
              aria-label="Search"
              title="Search"
              onClick={() => setMobileSearchOpen(true)}
              style={{
                width: 40, height: 40, borderRadius: 8,
                background: 'none', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#9CA3AF',
                padding: 0, flexShrink: 0, transition: 'color 0.12s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {(!isMobile || mobileSearchOpen) && (
          <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? 1 : undefined, minWidth: 0 }}>
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
              autoFocus={isMobile}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => {
                if (members.length > 0 || events.length > 0) setOpen(true)
              }}
              style={{
                width: isMobile ? '100%' : 280,
                height: isMobile ? 38 : 34,
                borderRadius: 8,
                border: '0.5px solid hsl(var(--border))',
                background: 'hsl(var(--muted))',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13,
                color: 'hsl(var(--foreground))',
                paddingLeft: 32,
                paddingRight: isMobile ? 12 : 40,
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
            {!isMobile && (
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
            )}

            {/* Results dropdown */}
            {open && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: isMobile ? '100%' : 280,
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
          )}

          {/* Cancel — exits mobile search mode */}
          {isMobile && mobileSearchOpen && (
            <button
              onClick={() => { setMobileSearchOpen(false); setQuery(''); setOpen(false) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: '#4F6BED',
                padding: '4px 2px', flexShrink: 0,
              }}
            >
              Cancel
            </button>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Help icon */}
          {!isMobile && (
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
          )}

          {/* Bell */}
          {!isMobile && (
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
          )}

          {/* Org trigger + dropdown — hidden while mobile search is open */}
          {!(isMobile && mobileSearchOpen) && (
          <div ref={orgDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setOrgDropdownOpen(v => !v); setBranchListOpen(false) }}
              aria-label="Organization menu"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: orgLogoUrl ? 'transparent' : '#4F6BED',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                border: orgLogoUrl ? '0.5px solid hsl(var(--border))' : 'none',
                padding: 0, overflow: 'hidden',
              }}
            >
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <span style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500, fontSize: 12, color: '#fff',
                }}>
                  {getInitials(orgName)}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {orgDropdownOpen && (
              <div className="org-dropdown-card" style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 280,
                background: 'hsl(var(--card))',
                border: '0.5px solid hsl(var(--border))',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'orgDropFadeIn 0.15s ease-out',
              }}>

                {/* Section 1 — Organization */}
                <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: orgLogoUrl ? 'transparent' : 'hsl(var(--muted))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    border: orgLogoUrl ? '0.5px solid hsl(var(--border))' : 'none',
                  }}>
                    {orgLogoUrl ? (
                      <img src={orgLogoUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18"/>
                        <path d="M5 21V7l7-4 7 4v14"/>
                        <path d="M9 21v-4h6v4"/>
                        <path d="M9 9h1"/><path d="M14 9h1"/>
                        <path d="M9 13h1"/><path d="M14 13h1"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 14, color: 'hsl(var(--foreground))',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {orgName}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 12, color: 'hsl(var(--muted-foreground))',
                      marginTop: 2,
                    }}>
                      {branchName || 'Main Branch'}
                    </div>
                    {user?.role && (
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontSize: 11, fontWeight: 500,
                        color: '#4F6BED',
                        background: '#E8ECF9',
                        borderRadius: 99, padding: '2px 8px',
                      }}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: 1, background: 'hsl(var(--border))' }} />

                {/* Section 2 — Signed-in user */}
                <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: user?.photo_url ? 'transparent' : '#4F6BED',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {user?.photo_url ? (
                      <img src={user.photo_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <span style={{
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontWeight: 500, fontSize: 11, color: '#fff',
                      }}>
                        {user?.full_name ? getInitials(user.full_name) : '?'}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 13, color: 'hsl(var(--foreground))',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {user?.full_name ?? ''}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 12, color: 'hsl(var(--muted-foreground))',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {user?.email ?? ''}
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: 'hsl(var(--border))' }} />

                {/* Section 3 — Actions */}
                <div style={{ padding: '4px 0' }}>
                  {/* Manage organization */}
                  <button
                    className="org-dropdown-item"
                    onClick={() => { setOrgDropdownOpen(false); navigate('/settings') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: 'hsl(var(--foreground))', textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Manage organization
                  </button>

                  {/* Switch branch — only for super_admin with >1 branch */}
                  {user?.role === 'super_admin' && branches.length > 1 && (
                    <>
                      <button
                        className="org-dropdown-item"
                        onClick={() => setBranchListOpen(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          padding: '9px 16px', background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontSize: 13, color: 'hsl(var(--foreground))', textAlign: 'left',
                          transition: 'background 0.12s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>
                          <rect x="8" y="9" width="14" height="11" rx="2"/>
                        </svg>
                        Switch branch
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', transform: branchListOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {branchListOpen && (
                        <div style={{ padding: '2px 8px 4px' }}>
                          {/* All branches option */}
                          <button
                            className="org-dropdown-item"
                            onClick={() => handleBranchSwitch('')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '7px 12px', background: 'none', border: 'none',
                              cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontSize: 12.5, color: 'hsl(var(--foreground))', textAlign: 'left',
                              borderRadius: 6, transition: 'background 0.12s',
                            }}
                          >
                            {selectedBranch === '' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F6BED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                            <span style={{ marginLeft: selectedBranch === '' ? 0 : 22 }}>All Branches</span>
                          </button>
                          {branches.map(b => (
                            <button
                              key={b.id}
                              className="org-dropdown-item"
                              onClick={() => handleBranchSwitch(b.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '7px 12px', background: 'none', border: 'none',
                                cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                                fontSize: 12.5, color: 'hsl(var(--foreground))', textAlign: 'left',
                                borderRadius: 6, transition: 'background 0.12s',
                              }}
                            >
                              {selectedBranch === b.id && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F6BED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                              <span style={{ marginLeft: selectedBranch === b.id ? 0 : 22 }}>{b.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Account settings */}
                  <button
                    className="org-dropdown-item"
                    onClick={() => { setOrgDropdownOpen(false); navigate('/settings') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: 'hsl(var(--foreground))', textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Account settings
                  </button>
                </div>

                <div style={{ height: 1, background: 'hsl(var(--border))' }} />

                {/* Section 4 — Sign out */}
                <div style={{ padding: '4px 0' }}>
                  <button
                    className="org-dropdown-item"
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#DC2626', textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </header>
    </>
  )
}

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

const NAV_VISIBILITY: Record<string, string[]> = {
  super_admin: ['/dashboard', '/members', '/donations', '/events', '/groups', '/reports', '/settings'],
  admin: ['/dashboard', '/members', '/donations', '/events', '/groups', '/reports', '/settings'],
  finance_officer: ['/members', '/donations', '/reports', '/settings'],
  group_leader: ['/groups', '/settings'],
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
  const [orgName, setOrgName] = useState('')

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

  // Org name — fetched live and refreshed on save from GeneralTab
  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('organisations').select('name')
      .eq('id', user.org_id).single()
      .then(({ data }) => { if (data) setOrgName(data.name) })
  }, [user?.org_id])

  useEffect(() => {
    const handler = () => {
      if (!user?.org_id) return
      supabase.from('organisations').select('name')
        .eq('id', user.org_id).single()
        .then(({ data }) => { if (data) setOrgName(data.name) })
    }
    window.addEventListener('org-name-updated', handler)
    return () => window.removeEventListener('org-name-updated', handler)
  }, [user?.org_id])

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

  const visibleNavItems = NAV_ITEMS.filter(item =>
    NAV_VISIBILITY[user?.role ?? '']?.includes(item.path)
  )

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
              <svg width="32" height="32" viewBox="204 269 997 1065" fill="none">
                <g transform="translate(0.000000,1600.000000) scale(0.100000,-0.100000)"
                fill="#FFFFFF" stroke="none">
                <path d="M7110 12913 c-19 -2 -102 -10 -185 -19 -82 -8 -166 -17 -185 -19 -97
                -9 -443 -74 -535 -100 -64 -18 -160 -44 -205 -55 -159 -41 -280 -83 -290 -101
                -7 -12 6 -892 16 -1089 15 -320 20 -468 16 -482 -4 -17 -20 -23 -52 -18 -16 1
                -43 15 -185 90 -49 26 -160 84 -245 128 -272 140 -375 196 -378 204 -2 4 -12
                8 -21 8 -10 0 -29 8 -42 18 -13 10 -40 25 -59 32 -19 8 -55 26 -80 40 -25 15
                -70 39 -100 54 -30 15 -77 40 -105 56 -27 16 -92 50 -144 76 -106 52 -106 52
                -186 -18 -24 -21 -48 -38 -54 -38 -6 0 -11 -4 -11 -10 0 -5 -18 -27 -41 -47
                -67 -62 -279 -275 -279 -280 0 -3 -11 -14 -25 -25 -25 -19 -123 -129 -195
                -217 -19 -24 -43 -52 -52 -64 -10 -11 -18 -23 -18 -26 0 -3 -10 -17 -23 -31
                -13 -14 -38 -47 -57 -75 -18 -27 -46 -66 -60 -85 -89 -118 -108 -147 -110
                -165 -4 -36 0 -44 23 -51 12 -3 33 -15 47 -25 14 -9 59 -35 100 -57 41 -21
                118 -62 170 -90 52 -28 147 -78 210 -110 63 -33 131 -69 150 -81 19 -12 53
                -30 75 -42 96 -49 250 -130 303 -160 31 -18 75 -42 97 -54 22 -11 50 -26 63
                -33 12 -7 32 -17 45 -24 39 -21 221 -120 267 -146 212 -118 382 -201 470 -227
                47 -14 105 -32 130 -41 25 -8 64 -14 86 -14 23 0 66 -5 95 -10 129 -25 422 -6
                562 35 139 41 166 51 217 73 30 13 73 33 95 45 22 11 49 25 60 30 11 6 27 14
                35 18 8 5 31 17 50 28 19 11 44 28 55 38 11 10 36 30 55 43 81 57 280 252 280
                275 0 3 12 18 26 34 33 37 134 207 134 226 0 8 5 17 10 20 6 3 10 15 10 26 0
                10 3 19 8 19 18 0 92 214 92 266 0 17 9 57 21 90 20 57 21 70 15 479 -3 231
                -10 465 -16 520 -6 55 -14 334 -19 619 -7 489 -9 520 -26 532 -18 14 -32 15
                -105 7z M7592 12895 c-10 -21 -10 -133 -2 -524 6 -273 15 -599 21 -726 5 -126
                14 -375 19 -553 7 -254 13 -333 26 -375 9 -28 20 -77 25 -107 12 -88 24 -131
                51 -190 15 -30 36 -77 47 -105 24 -55 27 -61 85 -155 57 -94 203 -266 276
                -325 82 -67 169 -134 195 -150 79 -51 286 -155 308 -155 7 0 21 -6 32 -14 11
                -7 38 -16 61 -19 22 -4 63 -13 90 -21 139 -40 416 -59 524 -35 25 5 77 13 115
                18 39 5 86 15 105 24 19 8 58 20 85 26 28 7 77 25 109 42 33 16 65 29 72 29 6
                0 42 18 78 40 36 22 70 40 76 40 5 0 10 5 10 10 0 6 5 10 10 10 6 0 37 18 69
                40 32 22 63 40 68 40 6 0 17 7 24 16 7 9 33 26 59 39 74 37 114 60 146 81 16
                11 46 29 67 39 20 11 37 23 37 27 0 5 5 8 11 8 6 0 80 43 164 95 84 52 156 95
                159 95 4 0 37 20 74 44 37 24 123 77 192 119 69 41 155 93 192 116 37 22 72
                41 78 41 5 0 10 5 10 10 0 6 6 10 13 11 23 1 200 115 221 142 l20 27 -20 27
                c-52 71 -94 133 -94 140 0 5 -10 20 -23 35 -49 59 -56 68 -74 95 -9 15 -34 45
                -55 67 -21 21 -38 42 -38 47 0 5 -17 26 -37 47 -21 21 -48 51 -60 66 -21 28
                -276 299 -301 320 -7 6 -54 51 -105 99 -50 49 -108 101 -127 115 -19 15 -42
                35 -52 45 -27 25 -46 22 -132 -28 -44 -25 -83 -45 -87 -45 -4 0 -9 -4 -11 -8
                -2 -4 -34 -26 -72 -48 -110 -62 -163 -94 -254 -155 -24 -16 -47 -29 -53 -29
                -5 0 -20 -9 -32 -21 -12 -11 -43 -30 -69 -42 -27 -12 -48 -25 -48 -29 0 -5 -5
                -8 -10 -8 -6 0 -29 -13 -52 -30 -22 -16 -45 -30 -50 -30 -5 0 -24 -10 -41 -23
                -18 -13 -77 -49 -132 -81 -112 -63 -127 -72 -170 -101 -16 -11 -47 -28 -67
                -39 -20 -10 -45 -26 -55 -35 -26 -24 -120 -53 -124 -38 -2 7 -30 835 -39 1152
                -10 372 -16 472 -28 492 -10 16 -199 81 -282 98 -19 4 -46 12 -60 18 -14 6
                -32 11 -40 12 -13 2 -131 30 -292 71 -32 8 -72 14 -90 14 -18 0 -65 7 -103 16
                -39 9 -119 20 -178 24 -59 5 -131 13 -160 19 -29 5 -106 13 -172 16 l-121 7
                -12 -27z M5380 12543 c-8 -3 -19 -10 -25 -15 -5 -4 -44 -30 -86 -56 -41 -26
                -84 -52 -95 -59 -31 -20 -124 -77 -143 -88 -9 -5 -42 -27 -73 -47 -31 -21 -59
                -38 -62 -38 -3 0 -15 -8 -26 -17 -22 -19 -70 -49 -135 -84 -22 -12 -52 -31
                -66 -43 -25 -20 -40 -29 -138 -86 -25 -14 -46 -31 -48 -36 -2 -6 36 -30 84
                -53 48 -24 95 -46 103 -51 8 -4 78 -39 155 -77 614 -308 626 -313 631 -298 5
                12 -12 392 -41 955 -3 47 -5 88 -5 93 0 8 -8 8 -30 0z M9415 12378 c2 -79 7
                -294 10 -478 6 -380 12 -460 31 -460 7 0 48 22 91 48 43 27 89 55 103 63 14 8
                27 16 30 19 3 3 16 11 29 18 63 36 92 53 166 96 90 52 81 46 195 118 47 29
                103 61 125 72 22 11 42 23 45 27 3 3 29 19 58 35 28 15 52 34 52 40 0 12 -65
                55 -175 114 -72 39 -128 72 -145 85 -8 7 -42 27 -75 45 -60 32 -113 63 -377
                219 -76 44 -145 81 -153 81 -12 0 -14 -21 -10 -142z M3015 10313 c-14 -15 -25
                -32 -25 -38 -1 -5 -12 -23 -25 -40 -14 -16 -39 -66 -56 -110 -18 -44 -38 -87
                -45 -95 -7 -8 -26 -51 -42 -95 -17 -44 -41 -102 -55 -130 -13 -27 -30 -68 -37
                -90 -7 -22 -16 -48 -21 -57 -5 -10 -9 -24 -9 -32 0 -7 -10 -35 -22 -62 -25
                -56 -55 -157 -67 -224 -4 -25 -17 -67 -29 -94 -12 -27 -22 -65 -22 -85 0 -20
                -4 -41 -10 -47 -10 -10 -29 -127 -30 -181 0 -27 7 -37 48 -65 52 -37 72 -49
                120 -73 17 -10 32 -21 32 -26 0 -5 5 -9 11 -9 5 0 37 -18 69 -40 32 -22 63
                -40 68 -40 5 0 27 -12 48 -28 21 -15 51 -33 66 -41 15 -8 36 -21 46 -30 10 -9
                33 -25 52 -35 19 -11 79 -48 132 -83 54 -34 100 -63 103 -63 4 0 33 -18 65
                -40 32 -22 61 -40 65 -40 7 0 146 -91 163 -107 7 -7 19 -13 26 -13 7 0 30 -13
                52 -30 21 -16 47 -30 57 -30 9 0 17 -4 17 -9 0 -5 12 -15 28 -22 64 -32 151
                -95 151 -111 1 -17 -71 -62 -264 -163 -135 -71 -149 -79 -155 -85 -7 -7 -37
                -24 -163 -89 -61 -32 -136 -72 -165 -89 -29 -18 -59 -32 -65 -32 -7 0 -17 -4
                -22 -9 -12 -11 -58 -37 -185 -104 -52 -27 -101 -54 -107 -59 -7 -6 -45 -27
                -85 -48 -129 -66 -163 -85 -166 -92 -2 -5 -10 -8 -18 -8 -7 0 -21 -11 -29 -24
                -15 -23 -15 -35 5 -163 11 -76 25 -146 30 -155 6 -10 10 -34 10 -53 0 -20 10
                -55 22 -78 12 -23 25 -62 29 -87 10 -57 42 -169 55 -195 6 -11 21 -51 34 -90
                35 -108 73 -208 86 -230 7 -11 24 -55 39 -98 15 -44 37 -94 49 -112 13 -18 28
                -48 35 -66 7 -19 18 -43 24 -54 6 -11 17 -32 24 -47 7 -14 20 -28 27 -31 18
                -7 56 3 56 14 0 5 8 9 18 9 10 0 22 4 28 10 5 5 36 24 69 41 190 100 244 129
                285 153 25 14 56 30 69 36 13 6 50 26 83 45 32 19 64 35 69 35 6 0 23 8 37 19
                15 10 61 36 102 58 41 22 104 56 140 75 115 63 202 109 330 176 69 35 145 77
                170 92 25 15 55 31 68 35 12 3 22 11 22 16 0 5 6 9 14 9 16 0 103 48 111 61 4
                5 13 9 22 9 9 0 24 6 32 14 9 7 42 27 74 44 67 37 108 64 167 112 70 58 196
                186 247 253 26 34 50 64 55 67 4 3 22 35 40 70 18 36 45 83 60 106 14 22 34
                63 43 90 9 27 23 63 30 79 59 131 87 303 89 534 2 266 -27 402 -133 633 -11
                26 -21 49 -21 52 0 3 -13 25 -30 49 -16 25 -30 50 -30 56 0 6 -4 11 -10 11 -5
                0 -10 8 -10 18 0 9 -13 32 -28 49 -15 18 -38 47 -52 64 -79 100 -118 141 -222
                231 -66 57 -205 153 -239 163 -10 4 -19 11 -19 16 0 5 -6 9 -13 9 -7 0 -36 16
                -66 35 -29 19 -57 35 -62 35 -6 0 -19 8 -30 19 -11 10 -49 33 -84 52 -36 19
                -65 37 -65 41 0 5 -5 8 -10 8 -6 0 -29 12 -53 28 -23 15 -47 29 -52 32 -13 6
                -230 140 -302 186 -29 19 -58 34 -65 34 -7 0 -29 14 -48 30 -19 16 -39 30 -44
                30 -5 0 -24 11 -42 25 -18 14 -36 25 -41 25 -5 0 -31 15 -58 33 -28 19 -81 51
                -120 72 -38 20 -77 43 -85 50 -8 7 -32 22 -52 34 -95 53 -116 65 -155 92 -23
                16 -49 29 -57 29 -9 0 -16 4 -16 8 0 5 -12 15 -27 23 -16 8 -48 26 -72 41 -25
                16 -48 28 -53 28 -4 0 -19 -12 -33 -27z M2416 8533 c-9 -9 -7 -1066 2 -1080 6
                -10 12 -8 24 5 24 25 39 36 78 55 19 10 67 37 105 62 39 24 75 44 81 45 6 0
                19 9 28 19 10 11 32 25 49 32 18 7 48 25 68 41 20 15 39 28 42 28 3 0 43 23
                89 51 90 56 124 76 177 105 19 11 44 27 55 36 11 10 29 21 40 24 11 4 26 13
                34 20 7 8 20 18 29 23 24 13 9 37 -39 61 -24 11 -63 32 -88 46 -25 14 -72 40
                -105 58 -33 18 -78 43 -100 56 -22 13 -62 36 -90 50 -27 15 -76 43 -108 61
                -84 49 -152 86 -233 129 -40 20 -85 47 -101 58 -17 12 -33 19 -37 15z M8960
                6630 c-47 -5 -108 -15 -135 -23 -28 -9 -77 -23 -110 -32 -66 -19 -72 -21 -165
                -62 -106 -47 -273 -143 -301 -175 -9 -10 -21 -18 -27 -18 -12 0 -216 -202
                -252 -250 -14 -18 -37 -47 -51 -64 -43 -52 -124 -197 -153 -271 -15 -38 -33
                -81 -40 -95 -15 -28 -37 -106 -56 -195 -6 -33 -17 -71 -22 -85 -6 -14 -14
                -183 -19 -400 -4 -206 -12 -485 -18 -620 -6 -135 -15 -423 -21 -640 -6 -217
                -13 -442 -17 -500 -8 -141 -5 -144 121 -135 50 4 138 13 195 21 58 8 129 14
                159 14 30 0 80 7 111 15 31 8 94 19 141 24 47 6 108 17 135 25 28 9 63 16 80
                16 16 0 47 6 70 14 22 8 65 19 95 26 30 7 87 22 125 35 39 12 90 28 115 35 25
                6 64 20 88 31 23 10 49 19 57 19 44 0 47 32 65 700 15 543 39 1032 52 1047 16
                20 36 16 92 -19 28 -17 69 -41 91 -53 22 -12 63 -35 90 -50 28 -15 75 -43 105
                -63 116 -74 156 -98 184 -110 16 -7 61 -34 100 -61 40 -26 76 -50 82 -52 13
                -5 202 -117 234 -138 14 -9 84 -52 155 -95 72 -43 175 -106 230 -141 l100 -64
                33 19 c18 11 55 41 83 67 110 105 366 362 396 399 18 21 46 55 63 74 17 19 45
                53 63 74 18 22 46 55 63 75 17 20 46 59 64 86 18 28 39 57 47 65 22 25 143
                198 143 205 0 4 9 20 21 36 37 52 25 77 -71 136 -47 30 -92 57 -100 60 -8 4
                -44 26 -80 48 -36 23 -89 55 -117 70 -29 16 -53 32 -53 37 0 4 -5 8 -11 8 -6
                0 -31 14 -56 30 -24 17 -46 30 -49 30 -3 0 -25 14 -49 30 -24 17 -50 30 -58
                30 -9 0 -17 3 -19 8 -2 4 -23 18 -48 31 -25 14 -94 56 -155 94 -128 81 -227
                142 -271 167 -17 10 -42 24 -55 32 -12 7 -32 21 -43 31 -11 9 -25 17 -31 17
                -6 0 -62 32 -125 72 -156 97 -192 118 -212 125 -10 3 -18 9 -18 14 0 5 -5 9
                -10 9 -6 0 -29 12 -53 27 -69 45 -97 58 -212 101 -128 47 -222 71 -320 83 -85
                10 -329 9 -445 -1z M5560 6589 c-52 -4 -108 -12 -123 -18 -16 -6 -42 -11 -58
                -11 -16 0 -47 -9 -69 -20 -22 -11 -55 -20 -75 -20 -19 0 -35 -4 -35 -8 0 -4
                -21 -14 -47 -21 -27 -8 -50 -17 -53 -21 -6 -8 -135 -70 -146 -70 -4 0 -15 -6
                -23 -14 -9 -7 -41 -26 -71 -42 -30 -16 -57 -31 -60 -34 -3 -4 -21 -12 -40 -20
                -19 -8 -37 -16 -40 -19 -11 -12 -50 -31 -65 -31 -8 0 -15 -4 -15 -8 0 -5 -26
                -21 -57 -35 -32 -15 -78 -39 -103 -54 -25 -14 -72 -41 -105 -58 -121 -65 -130
                -70 -133 -77 -2 -5 -11 -8 -20 -8 -8 0 -23 -6 -31 -14 -9 -8 -74 -44 -146 -81
                -149 -77 -199 -106 -203 -117 -2 -4 -9 -8 -16 -8 -14 0 -218 -100 -226 -111
                -3 -3 -52 -31 -110 -61 -58 -30 -127 -68 -155 -83 -27 -15 -68 -37 -90 -48
                -51 -28 -75 -48 -75 -63 0 -12 166 -263 180 -274 4 -3 19 -23 33 -45 14 -22
                36 -51 49 -65 12 -14 35 -41 49 -60 15 -19 37 -47 50 -61 13 -15 51 -59 84
                -99 162 -197 494 -524 544 -537 24 -6 177 65 316 148 33 19 76 42 95 49 19 8
                55 27 79 42 25 15 51 28 58 28 7 0 13 5 13 10 0 6 9 10 19 10 11 0 23 5 26 10
                3 6 23 18 43 29 68 34 356 183 432 224 41 22 134 70 205 107 72 36 156 81 188
                99 35 20 68 31 85 29 l27 -3 -3 -180 c-2 -99 -8 -241 -13 -315 -5 -74 -12
                -374 -16 -666 l-6 -530 29 -11 c50 -19 146 -50 239 -78 50 -15 114 -36 143
                -46 29 -10 68 -19 87 -19 19 0 35 -4 35 -10 0 -5 15 -10 33 -11 17 0 70 -9
                117 -20 47 -11 117 -24 155 -29 39 -4 98 -15 131 -24 34 -9 88 -16 120 -16 33
                0 106 -7 164 -15 58 -8 137 -15 177 -15 60 0 74 3 82 18 6 11 10 143 10 318 1
                164 6 394 11 509 6 116 17 345 25 510 8 165 15 415 15 555 0 237 -2 262 -25
                355 -13 55 -25 108 -25 117 0 10 -6 32 -14 50 -8 18 -24 66 -37 106 -12 39
                -25 72 -29 72 -3 0 -12 17 -19 38 -8 20 -32 66 -54 102 -22 36 -49 81 -60 100
                -39 66 -160 206 -236 274 -13 11 -29 26 -35 31 -92 83 -193 149 -316 207 -172
                81 -233 103 -355 130 -165 36 -315 44 -515 27z M9452 4548 c-7 -7 -12 -45 -12
                -97 0 -48 -4 -135 -9 -196 -6 -60 -15 -240 -21 -400 -6 -159 -13 -305 -15
                -322 -3 -26 0 -33 13 -33 13 0 478 223 567 272 11 6 47 25 80 41 33 16 68 33
                78 38 10 6 60 30 110 55 51 25 99 49 107 53 27 15 21 36 -17 56 -20 11 -69 41
                -108 66 -38 25 -86 54 -105 65 -19 10 -37 22 -40 25 -3 4 -34 24 -70 45 -36
                21 -72 43 -81 49 -16 10 -28 18 -169 109 -47 30 -90 59 -97 65 -7 6 -17 11
                -22 11 -5 0 -16 7 -24 14 -8 8 -32 25 -53 36 -22 12 -53 30 -70 41 -23 14 -33
                16 -42 7z M5400 4531 c-19 -9 -37 -18 -40 -21 -5 -5 -35 -22 -72 -42 -13 -6
                -30 -15 -38 -19 -8 -5 -37 -20 -65 -34 -164 -84 -325 -170 -357 -191 -21 -13
                -42 -24 -48 -24 -10 0 -51 -21 -60 -31 -3 -3 -23 -13 -45 -24 -22 -10 -57 -29
                -77 -42 -21 -12 -44 -23 -52 -23 -24 0 -37 -24 -23 -42 6 -8 75 -55 152 -104
                190 -120 238 -151 252 -164 7 -5 17 -10 23 -10 5 0 10 -4 10 -10 0 -5 5 -10
                11 -10 6 0 38 -18 70 -40 32 -22 61 -40 64 -40 3 0 11 -5 18 -11 7 -5 71 -48
                142 -94 124 -81 185 -106 171 -69 -5 13 -1 286 16 957 1 48 -2 91 -8 96 -5 5
                -23 2 -44 -8z"/>
                </g>
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
            {orgName.toUpperCase()}
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

        {visibleNavItems.map(item => {
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

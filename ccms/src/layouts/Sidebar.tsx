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
                <path d="M0 8000 l0 -8000 7030 0 7030 0 0 8000 0 8000 -7030 0 -7030 0 0
                -8000z m7215 4906 c17 -12 19 -43 26 -532 5 -285 13 -564 19 -619 6 -55 13
                -289 16 -520 6 -409 5 -422 -15 -479 -12 -33 -21 -73 -21 -90 0 -52 -74 -266
                -92 -266 -5 0 -8 -9 -8 -19 0 -11 -4 -23 -10 -26 -5 -3 -10 -12 -10 -20 0 -19
                -101 -189 -134 -226 -14 -16 -26 -31 -26 -34 0 -23 -199 -218 -280 -275 -19
                -13 -44 -33 -55 -43 -11 -10 -36 -27 -55 -38 -19 -11 -42 -23 -50 -28 -8 -4
                -24 -12 -35 -18 -11 -5 -38 -19 -60 -30 -22 -12 -65 -32 -95 -45 -51 -22 -78
                -32 -217 -73 -140 -41 -433 -60 -562 -35 -29 5 -72 10 -95 10 -22 0 -61 6 -86
                14 -25 9 -83 27 -130 41 -88 26 -258 109 -470 227 -46 26 -228 125 -267 146
                -13 7 -33 17 -45 24 -13 7 -41 22 -63 33 -22 12 -66 36 -97 54 -53 30 -207
                111 -303 160 -22 12 -56 30 -75 42 -19 12 -87 48 -150 81 -63 32 -158 82 -210
                110 -52 28 -129 69 -170 90 -41 22 -86 48 -100 57 -14 10 -35 22 -47 25 -23 7
                -27 15 -23 51 2 18 21 47 110 165 14 19 42 58 60 85 19 28 44 61 57 75 13 14
                23 28 23 31 0 3 8 15 18 26 9 12 33 40 52 64 72 88 170 198 195 217 14 11 25
                22 25 25 0 5 212 218 279 280 23 20 41 42 41 47 0 6 5 10 11 10 6 0 30 17 54
                38 80 70 80 70 186 18 52 -26 117 -60 144 -76 28 -16 75 -41 105 -56 30 -15
                75 -39 100 -54 25 -14 61 -32 80 -40 19 -7 46 -22 59 -32 13 -10 32 -18 42
                -18 9 0 19 -4 21 -8 3 -8 106 -64 378 -204 85 -44 196 -102 245 -128 142 -75
                169 -89 185 -90 32 -5 48 1 52 18 4 14 -1 162 -16 482 -10 197 -23 1077 -16
                1089 10 18 131 60 290 101 45 11 141 37 205 55 92 26 438 91 535 100 19 2 103
                11 185 19 201 21 216 23 246 24 14 1 34 -4 44 -12z m682 -7 c29 -6 101 -14
                160 -19 59 -4 139 -15 178 -24 38 -9 85 -16 103 -16 18 0 58 -6 90 -14 161
                -41 279 -69 292 -71 8 -1 26 -6 40 -12 14 -6 41 -14 60 -18 83 -17 272 -82
                282 -98 12 -20 18 -120 28 -492 9 -317 37 -1145 39 -1152 4 -15 98 14 124 38
                10 9 35 25 55 35 20 11 51 28 67 39 43 29 58 38 170 101 55 32 114 68 132 81
                17 13 36 23 41 23 5 0 28 14 50 30 23 17 46 30 52 30 5 0 10 3 10 8 0 4 21 17
                48 29 26 12 57 31 69 42 12 12 27 21 32 21 6 0 29 13 53 29 91 61 144 93 254
                155 38 22 70 44 72 48 2 4 7 8 11 8 4 0 43 20 87 45 86 50 105 53 132 28 10
                -10 33 -30 52 -45 19 -14 77 -66 127 -115 51 -48 98 -93 105 -99 25 -21 280
                -292 301 -320 12 -15 39 -45 60 -66 20 -21 37 -42 37 -47 0 -5 17 -26 38 -47
                21 -22 46 -52 55 -67 18 -27 25 -36 74 -95 13 -15 23 -30 23 -35 0 -7 42 -69
                94 -140 l20 -27 -20 -27 c-21 -27 -198 -141 -221 -142 -7 -1 -13 -5 -13 -11 0
                -5 -5 -10 -10 -10 -6 0 -41 -19 -78 -41 -37 -23 -123 -75 -192 -116 -69 -42
                -155 -95 -192 -119 -37 -24 -70 -44 -74 -44 -3 0 -75 -43 -159 -95 -84 -52
                -158 -95 -164 -95 -6 0 -11 -3 -11 -8 0 -4 -17 -16 -37 -27 -21 -10 -51 -28
                -67 -39 -32 -21 -72 -44 -146 -81 -26 -13 -52 -30 -59 -39 -7 -9 -18 -16 -24
                -16 -5 0 -36 -18 -68 -40 -32 -22 -63 -40 -69 -40 -5 0 -10 -4 -10 -10 0 -5
                -5 -10 -10 -10 -6 0 -40 -18 -76 -40 -36 -22 -72 -40 -78 -40 -7 0 -39 -13
                -72 -29 -32 -17 -81 -35 -109 -42 -27 -6 -66 -18 -85 -26 -19 -9 -66 -19 -105
                -24 -38 -5 -90 -13 -115 -18 -108 -24 -385 -5 -524 35 -27 8 -68 17 -90 21
                -23 3 -50 12 -61 19 -11 8 -25 14 -32 14 -22 0 -229 104 -308 155 -26 16 -113
                83 -195 150 -73 59 -219 231 -276 325 -58 94 -61 100 -85 155 -11 28 -32 75
                -47 105 -27 59 -39 102 -51 190 -5 30 -16 79 -25 107 -13 42 -19 121 -26 375
                -5 178 -14 427 -19 553 -6 127 -15 453 -21 726 -8 391 -8 503 2 524 l12 27
                121 -7 c66 -3 143 -11 172 -16z m-2487 -356 c0 -5 2 -46 5 -93 29 -563 46
                -943 41 -955 -5 -15 -17 -10 -631 298 -77 38 -147 73 -155 77 -8 5 -55 27
                -103 51 -48 23 -86 47 -84 53 2 5 23 22 48 36 98 57 113 66 138 86 14 12 44
                31 66 43 65 35 113 65 135 84 11 9 23 17 26 17 3 0 31 17 62 38 31 20 64 42
                73 47 19 11 112 68 143 88 11 7 54 33 95 59 42 26 81 52 86 56 22 18 55 27 55
                15z m4168 -104 c264 -156 317 -187 377 -219 33 -18 67 -38 75 -45 17 -13 73
                -46 145 -85 110 -59 175 -102 175 -114 0 -6 -24 -25 -52 -40 -29 -16 -55 -32
                -58 -35 -3 -4 -23 -16 -45 -27 -22 -11 -78 -43 -125 -72 -114 -72 -105 -66
                -195 -118 -74 -43 -103 -60 -166 -96 -13 -7 -26 -15 -29 -18 -3 -3 -16 -11
                -30 -19 -14 -8 -60 -36 -103 -63 -43 -26 -84 -48 -91 -48 -19 0 -25 80 -31
                460 -3 184 -8 399 -10 478 -4 121 -2 142 10 142 8 0 77 -37 153 -81z m-6477
                -2127 c24 -15 56 -33 72 -41 15 -8 27 -18 27 -23 0 -4 7 -8 16 -8 8 0 34 -13
                57 -29 39 -27 60 -39 155 -92 20 -12 44 -27 52 -34 8 -7 47 -30 85 -50 39 -21
                92 -53 120 -72 27 -18 53 -33 58 -33 5 0 23 -11 41 -25 18 -14 37 -25 42 -25
                5 0 25 -14 44 -30 19 -16 41 -30 48 -30 7 0 36 -15 65 -34 72 -46 289 -180
                302 -186 5 -3 29 -17 52 -32 24 -16 47 -28 53 -28 5 0 10 -3 10 -8 0 -4 29
                -22 65 -41 35 -19 73 -42 84 -52 11 -11 24 -19 30 -19 5 0 33 -16 62 -35 30
                -19 59 -35 66 -35 7 0 13 -4 13 -9 0 -5 9 -12 19 -16 34 -10 173 -106 239
                -163 104 -90 143 -131 222 -231 14 -17 37 -46 52 -64 15 -17 28 -40 28 -49 0
                -10 5 -18 10 -18 6 0 10 -5 10 -11 0 -6 14 -31 30 -56 17 -24 30 -46 30 -49 0
                -3 10 -26 21 -52 106 -231 135 -367 133 -633 -2 -231 -30 -403 -89 -534 -7
                -16 -21 -52 -30 -79 -9 -27 -29 -68 -43 -90 -15 -23 -42 -70 -60 -106 -18 -35
                -36 -67 -40 -70 -5 -3 -29 -33 -55 -67 -51 -67 -177 -195 -247 -253 -59 -48
                -100 -75 -167 -112 -32 -17 -65 -37 -74 -44 -8 -8 -23 -14 -32 -14 -9 0 -18
                -4 -22 -9 -8 -13 -95 -61 -111 -61 -8 0 -14 -4 -14 -9 0 -5 -10 -13 -22 -16
                -13 -4 -43 -20 -68 -35 -25 -15 -101 -57 -170 -92 -128 -67 -215 -113 -330
                -176 -36 -19 -99 -53 -140 -75 -41 -22 -87 -48 -102 -58 -14 -11 -31 -19 -37
                -19 -5 0 -37 -16 -69 -35 -33 -19 -70 -39 -83 -45 -13 -6 -44 -22 -69 -36 -41
                -24 -95 -53 -285 -153 -33 -17 -64 -36 -69 -41 -6 -6 -18 -10 -28 -10 -10 0
                -18 -4 -18 -9 0 -11 -38 -21 -56 -14 -7 3 -20 17 -27 31 -7 15 -18 36 -24 47
                -6 11 -17 35 -24 54 -7 18 -22 48 -35 66 -12 18 -34 68 -49 112 -15 43 -32 87
                -39 98 -13 22 -51 122 -86 230 -13 39 -28 79 -34 90 -13 26 -45 138 -55 195
                -4 25 -17 64 -29 87 -12 23 -22 58 -22 78 0 19 -4 43 -10 53 -5 9 -19 79 -30
                155 -20 128 -20 140 -5 163 8 13 22 24 29 24 8 0 16 3 18 8 3 7 37 26 166 92
                40 21 78 42 85 48 6 5 55 32 107 59 127 67 173 93 185 104 5 5 15 9 22 9 6 0
                36 14 65 32 29 17 104 57 165 89 126 65 156 82 163 89 6 6 20 14 155 85 193
                101 265 146 264 163 0 16 -87 79 -151 111 -16 7 -28 17 -28 22 0 5 -8 9 -17 9
                -10 0 -36 14 -57 30 -22 17 -45 30 -52 30 -7 0 -19 6 -26 13 -17 16 -156 107
                -163 107 -4 0 -33 18 -65 40 -32 22 -61 40 -65 40 -3 0 -49 29 -103 63 -53 35
                -113 72 -132 83 -19 10 -42 26 -52 35 -10 9 -31 22 -46 30 -15 8 -45 26 -66
                41 -21 16 -43 28 -48 28 -5 0 -36 18 -68 40 -32 22 -64 40 -69 40 -6 0 -11 4
                -11 9 0 5 -15 16 -32 26 -48 24 -68 36 -120 73 -41 28 -48 38 -48 65 1 54 20
                171 30 181 6 6 10 27 10 47 0 20 10 58 22 85 12 27 25 69 29 94 12 67 42 168
                67 224 12 27 22 55 22 62 0 8 4 22 9 32 5 9 14 35 21 57 7 22 24 63 37 90 14
                28 38 86 55 130 16 44 35 87 42 95 7 8 27 51 45 95 17 44 42 94 56 110 13 17
                24 35 25 40 0 12 48 65 58 65 5 0 28 -12 53 -28z m-547 -1852 c81 -43 149 -80
                233 -129 32 -18 81 -46 108 -61 28 -14 68 -37 90 -50 22 -13 67 -38 100 -56
                33 -18 80 -44 105 -58 25 -14 64 -35 88 -46 48 -24 63 -48 39 -61 -9 -5 -22
                -15 -29 -23 -8 -7 -23 -16 -34 -20 -11 -3 -29 -14 -40 -24 -11 -9 -36 -25 -55
                -36 -53 -29 -87 -49 -177 -105 -46 -28 -86 -51 -89 -51 -3 0 -22 -13 -42 -28
                -20 -16 -50 -34 -68 -41 -17 -7 -39 -21 -49 -32 -9 -10 -22 -19 -28 -19 -6 -1
                -42 -21 -81 -45 -38 -25 -86 -52 -105 -62 -39 -19 -54 -30 -78 -55 -12 -13
                -18 -15 -24 -5 -9 14 -11 1071 -2 1080 4 4 20 -3 37 -15 16 -11 61 -38 101
                -58z m6851 -1829 c98 -12 192 -36 320 -83 115 -43 143 -56 212 -101 24 -15 47
                -27 53 -27 5 0 10 -4 10 -9 0 -5 8 -11 18 -14 20 -7 56 -28 212 -125 63 -40
                119 -72 125 -72 6 0 20 -8 31 -17 11 -10 31 -24 43 -31 13 -8 38 -22 55 -32
                44 -25 143 -86 271 -167 61 -38 130 -80 155 -94 25 -13 46 -27 48 -31 2 -5 10
                -8 19 -8 8 0 34 -13 58 -30 24 -16 46 -30 49 -30 3 0 25 -13 49 -30 25 -16 50
                -30 56 -30 6 0 11 -4 11 -8 0 -5 24 -21 53 -37 28 -15 81 -47 117 -70 36 -22
                72 -44 80 -48 8 -3 53 -30 100 -60 96 -59 108 -84 71 -136 -12 -16 -21 -32
                -21 -36 0 -7 -121 -180 -143 -205 -8 -8 -29 -37 -47 -65 -18 -27 -47 -66 -64
                -86 -17 -20 -45 -53 -63 -75 -18 -21 -46 -55 -63 -74 -17 -19 -45 -53 -63 -74
                -30 -37 -286 -294 -396 -399 -28 -26 -65 -56 -83 -67 l-33 -19 -100 64 c-55
                35 -158 98 -230 141 -71 43 -141 86 -155 95 -32 21 -221 133 -234 138 -6 2
                -42 26 -82 52 -39 27 -84 54 -100 61 -28 12 -68 36 -184 110 -30 20 -77 48
                -105 63 -27 15 -68 38 -90 50 -22 12 -63 36 -91 53 -56 35 -76 39 -92 19 -13
                -15 -37 -504 -52 -1047 -18 -668 -21 -700 -65 -700 -8 0 -34 -9 -57 -19 -24
                -11 -63 -25 -88 -31 -25 -7 -76 -23 -115 -35 -38 -13 -95 -28 -125 -35 -30 -7
                -73 -18 -95 -26 -23 -8 -54 -14 -70 -14 -17 0 -52 -7 -80 -16 -27 -8 -88 -19
                -135 -25 -47 -5 -110 -16 -141 -24 -31 -8 -81 -15 -111 -15 -30 0 -101 -6
                -159 -14 -57 -8 -145 -17 -195 -21 -126 -9 -129 -6 -121 135 4 58 11 283 17
                500 6 217 15 505 21 640 6 135 14 414 18 620 5 217 13 386 19 400 5 14 16 52
                22 85 19 89 41 167 56 195 7 14 25 57 40 95 29 74 110 219 153 271 14 17 37
                46 51 64 36 48 240 250 252 250 6 0 18 8 27 18 28 32 195 128 301 175 93 41
                99 43 165 62 33 9 82 23 110 32 93 28 422 42 580 24z m-3500 -41 c138 -15 262
                -45 380 -93 199 -81 344 -166 461 -272 6 -5 22 -20 35 -31 76 -68 197 -208
                236 -274 11 -19 38 -64 60 -100 22 -36 46 -82 54 -102 7 -21 16 -38 19 -38 4
                0 17 -33 29 -72 13 -40 29 -88 37 -106 8 -18 14 -40 14 -50 0 -9 12 -62 25
                -117 23 -93 25 -118 25 -355 0 -140 -7 -390 -15 -555 -8 -165 -19 -394 -25
                -510 -5 -115 -10 -345 -11 -509 0 -175 -4 -307 -10 -318 -8 -15 -22 -18 -82
                -18 -40 0 -119 7 -177 15 -58 8 -131 15 -164 15 -32 0 -86 7 -120 16 -33 9
                -92 20 -131 24 -38 5 -108 18 -155 29 -47 11 -100 20 -117 20 -18 1 -33 6 -33
                11 0 6 -16 10 -35 10 -19 0 -58 9 -87 19 -29 10 -93 31 -143 46 -93 28 -189
                59 -239 78 l-29 11 6 530 c4 292 11 592 16 666 5 74 11 216 13 315 l3 180 -27
                3 c-17 2 -50 -9 -85 -29 -32 -18 -116 -63 -188 -99 -71 -37 -164 -85 -205
                -107 -76 -41 -364 -190 -432 -224 -20 -11 -40 -23 -43 -29 -3 -5 -15 -10 -26
                -10 -10 0 -19 -4 -19 -10 0 -5 -6 -10 -13 -10 -7 0 -33 -13 -58 -28 -24 -15
                -60 -34 -79 -42 -19 -7 -62 -30 -95 -49 -139 -83 -292 -154 -316 -148 -50 13
                -382 340 -544 537 -33 40 -71 84 -84 99 -13 14 -35 42 -50 61 -14 19 -37 46
                -49 60 -13 14 -35 43 -49 65 -14 22 -29 42 -33 45 -14 11 -180 262 -180 274 0
                15 24 35 75 63 22 11 63 33 90 48 28 15 97 53 155 83 58 30 107 58 110 61 8
                11 212 111 226 111 7 0 14 4 16 8 4 11 54 40 203 117 72 37 137 73 146 81 8 8
                23 14 31 14 9 0 18 3 20 8 3 7 12 12 133 77 33 17 80 44 105 58 25 15 71 39
                103 54 31 14 57 30 57 35 0 4 7 8 15 8 15 0 54 19 65 31 3 3 21 11 40 19 19 8
                37 16 40 20 3 3 30 18 60 34 30 16 62 35 71 42 8 8 19 14 23 14 11 0 140 62
                146 70 3 4 26 13 53 21 26 7 47 17 47 21 0 4 16 8 35 8 20 0 53 9 75 20 22 11
                53 20 69 20 16 0 42 5 58 11 61 23 327 34 468 19z m3659 -2090 c21 -11 45 -28
                53 -36 8 -7 19 -14 24 -14 5 0 15 -5 22 -11 7 -6 50 -35 97 -65 141 -91 153
                -99 169 -109 9 -6 45 -28 81 -49 36 -21 67 -41 70 -45 3 -3 21 -15 40 -25 19
                -11 67 -40 105 -65 39 -25 88 -55 108 -66 38 -20 44 -41 17 -56 -8 -4 -56 -28
                -107 -53 -50 -25 -100 -49 -110 -55 -10 -5 -45 -22 -78 -38 -33 -16 -69 -35
                -80 -41 -89 -49 -554 -272 -567 -272 -13 0 -16 7 -13 33 2 17 9 163 15 322 6
                160 15 340 21 400 5 61 9 148 9 196 0 102 9 117 54 90 17 -11 48 -29 70 -41z
                m-4112 -57 c-17 -671 -21 -944 -16 -957 14 -37 -47 -12 -171 69 -71 46 -135
                89 -142 94 -7 6 -15 11 -18 11 -3 0 -32 18 -64 40 -32 22 -64 40 -70 40 -6 0
                -11 5 -11 10 0 6 -5 10 -10 10 -6 0 -16 5 -23 10 -14 13 -62 44 -252 164 -77
                49 -146 96 -152 104 -14 18 -1 42 23 42 8 0 31 11 52 23 20 13 55 32 77 42 22
                11 42 21 45 24 9 10 50 31 60 31 6 0 27 11 48 24 32 21 193 107 357 191 28 14
                57 29 65 34 8 4 25 13 38 19 37 20 67 37 72 42 16 16 76 37 84 29 6 -5 9 -48
                8 -96z"/>
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

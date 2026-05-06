import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'visitor' | 'pending' | 'transferred' | 'deceased'
type GenderFilter = 'all' | 'male' | 'female'
type AgeGroupFilter = 'all' | 'youth' | 'young_adult' | 'senior'
type MembershipLengthFilter = 'all' | 'new' | 'established' | 'long_term'

interface Ministry { id: string; name: string }

interface Member {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  gender: string | null
  date_of_birth: string | null
  membership_status: MemberStatus
  member_number: string | null
  created_at: string
  membership_date: string | null
  branches: { id: string; name: string } | null
  group_memberships: Array<{
    groups: { ministries: { id: string; name: string } | null } | null
  }> | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const STATUS_STYLES: Record<MemberStatus, { bg: string; color: string; label: string }> = {
  active:      { bg: '#DCFCE7', color: '#166534', label: 'Active' },
  inactive:    { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive' },
  visitor:     { bg: '#DBEAFE', color: '#1E40AF', label: 'Visitor' },
  pending:     { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  transferred: { bg: '#EEF2FF', color: '#4338CA', label: 'Transferred' },
  deceased:    { bg: '#FEE2E2', color: '#991B1B', label: 'Deceased' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  const age = now.getFullYear() - birth.getFullYear()
  const notYet = now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
  return notYet ? age - 1 : age
}

function membershipYears(date: string | null): number | null {
  if (!date) return null
  const d = new Date(date)
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-2.9-2.9" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {dir === 'left'
        ? <path d="M9 11 5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      }
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="18" r="8" stroke="#E5E7EB" strokeWidth="2" />
      <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 2v8M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: '#E8ECF9', color: '#4F6BED',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: string | undefined }) {
  const s = STATUS_STYLES[status?.toLowerCase() as MemberStatus]
    ?? { bg: '#F3F4F6', color: '#6B7280', label: status ?? 'Unknown' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 5, padding: '2px 8px',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500, fontSize: 12,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function SkeletonRow() {
  const pulse: React.CSSProperties = {
    background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-pulse 1.4s ease infinite',
    borderRadius: 4,
  }
  return (
    <tr>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...pulse, width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div>
            <div style={{ ...pulse, width: 120, height: 13, marginBottom: 5 }} />
            <div style={{ ...pulse, width: 72, height: 11 }} />
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ ...pulse, width: 140, height: 13, marginBottom: 5 }} />
        <div style={{ ...pulse, width: 96, height: 11 }} />
      </td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 60, height: 20 }} /></td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 80, height: 13 }} /></td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 88, height: 13 }} /></td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 20, height: 20, borderRadius: '50%' }} /></td>
    </tr>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={6}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 80, gap: 12,
        }}>
          <PersonIcon />
          <div style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 16, color: '#111827',
          }}>
            No members yet
          </div>
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#9CA3AF',
          }}>
            Add your first member to get started
          </div>
          <button onClick={onAdd} style={{
            marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#4F6BED', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            height: 38, padding: '0 16px',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 500, fontSize: 13,
          }}>
            <PlusIcon /> Add Member
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MembersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [members, setMembers] = useState<Member[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newThisMonth, setNewThisMonth] = useState<number>(0)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [ageGroupFilter, setAgeGroupFilter] = useState<AgeGroupFilter>('all')
  const [membershipLengthFilter, setMembershipLengthFilter] = useState<MembershipLengthFilter>('all')
  const [ministryFilter, setMinistryFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!user?.org_id) return
    setLoading(true)
    setError(null)
    supabase
      .from('members')
      .select(`
        *,
        branches(id, name),
        group_memberships(
          groups(
            ministries(id, name)
          )
        )
      `)
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setMembers((data as Member[]) ?? [])
        setLoading(false)
      })
  }, [user?.org_id])

  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('ministries')
      .select('id, name')
      .eq('org_id', user.org_id)
      .order('name')
      .then(({ data }) => { if (data) setMinistries(data) })
  }, [user?.org_id])

  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', user.org_id)
      .gte('created_at', startOfMonth(new Date()).toISOString())
      .then(({ count }) => { if (count !== null) setNewThisMonth(count) })
  }, [user?.org_id])

  useEffect(() => { setPage(1) }, [search, statusFilter, genderFilter, ageGroupFilter, membershipLengthFilter, ministryFilter])

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q) ||
      (m.member_number ?? '').toLowerCase().includes(q)

    const matchesStatus = statusFilter === 'all' || m.membership_status === statusFilter

    const matchesGender = genderFilter === 'all' || (m.gender ?? '').toLowerCase() === genderFilter

    const age = calculateAge(m.date_of_birth)
    const matchesAge = ageGroupFilter === 'all' ||
      (ageGroupFilter === 'youth'       && age !== null && age >= 18 && age <= 35) ||
      (ageGroupFilter === 'young_adult' && age !== null && age >= 36 && age <= 50) ||
      (ageGroupFilter === 'senior'      && age !== null && age > 50)

    const years = membershipYears(m.membership_date)
    const matchesMembershipLength = membershipLengthFilter === 'all' ||
      (membershipLengthFilter === 'new'         && years !== null && years < 1) ||
      (membershipLengthFilter === 'established' && years !== null && years >= 1 && years <= 5) ||
      (membershipLengthFilter === 'long_term'   && years !== null && years > 5)

    const memberMinistryId = m.group_memberships?.[0]?.groups?.ministries?.id ?? null
    const matchesMinistry = ministryFilter === 'all' || memberMinistryId === ministryFilter

    return matchesSearch && matchesStatus && matchesGender && matchesAge && matchesMembershipLength && matchesMinistry
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const formatMemberNumber = (n: string | null) => n ?? '—'

  const th: React.CSSProperties = {
    padding: '12px 16px',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 11,
    color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: '0.5px solid #E5E7EB',
    background: '#F9FAFB', whiteSpace: 'nowrap',
  }

  const inputStyle: React.CSSProperties = {
    height: 38, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827',
    background: '#fff', outline: 'none',
    transition: 'border-color 0.15s',
  }

  const tabBase: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 14,
    padding: '8px 0', marginRight: 24,
    transition: 'color 0.12s',
  }

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .member-row:hover { background: #F9FAFB !important; }
        .member-row:hover .row-arrow { opacity: 1 !important; }
        .filter-input:focus { border-color: #4F6BED !important; }
        .filter-select:focus { border-color: #4F6BED !important; outline: none; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 20, color: '#111827',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            Members
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 0,
          }}>
            {loading ? 'Loading…' : `${members.length} members · ${newThisMonth} new this month`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => toast.info('Import feature coming soon')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', color: '#374151',
              border: '0.5px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
              height: 38, padding: '0 14px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, flexShrink: 0,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <ImportIcon /> Import
          </button>
          <button
            onClick={() => navigate('/members/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#4F6BED', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              height: 38, padding: '0 16px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, flexShrink: 0,
            }}
          >
            <PlusIcon /> Add Member
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '0.5px solid #E5E7EB',
        marginBottom: 16,
      }}>
        <button
          style={{
            ...tabBase,
            color: '#4F6BED',
            borderBottom: '2px solid #4F6BED',
          }}
        >
          All Members
        </button>
        <button
          onClick={() => navigate('/members/households')}
          style={{
            ...tabBase,
            color: '#6B7280',
            borderBottom: '2px solid transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
        >
          Households
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            className="filter-input"
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>

        {/* Dropdowns */}
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="visitor">Visitor</option>
          <option value="pending">Pending</option>
          <option value="transferred">Transferred</option>
          <option value="deceased">Deceased</option>
        </select>

        <select
          className="filter-select"
          value={genderFilter}
          onChange={e => setGenderFilter(e.target.value as GenderFilter)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        <select
          className="filter-select"
          value={ageGroupFilter}
          onChange={e => setAgeGroupFilter(e.target.value as AgeGroupFilter)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">All Ages</option>
          <option value="youth">Youth (18–35)</option>
          <option value="young_adult">Young Adult (36–50)</option>
          <option value="senior">Senior (50+)</option>
        </select>

        <select
          className="filter-select"
          value={membershipLengthFilter}
          onChange={e => setMembershipLengthFilter(e.target.value as MembershipLengthFilter)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">Membership Length</option>
          <option value="new">New (&lt;1 year)</option>
          <option value="established">Established (1–5 yrs)</option>
          <option value="long_term">Long-term (5+ yrs)</option>
        </select>

        <select
          className="filter-select"
          value={ministryFilter}
          onChange={e => setMinistryFilter(e.target.value)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">All Ministries</option>
          {ministries.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '0.5px solid #FECACA',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#991B1B',
        }}>
          Failed to load members: {error}
        </div>
      )}

      {/* Table Card */}
      <div style={{
        background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Member</th>
              <th style={th}>Contact</th>
              <th style={th}>Status</th>
              <th style={th}>Branch</th>
              <th style={th}>Ministry</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : paginated.length === 0 ? (
              <EmptyState onAdd={() => navigate('/members/new')} />
            ) : (
              paginated.map(member => (
                <tr
                  key={member.id}
                  className="member-row"
                  onClick={() => navigate(`/members/${member.id}`)}
                  style={{
                    borderBottom: '0.5px solid #F3F4F6',
                    height: 56, background: '#fff',
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                >
                  {/* Member */}
                  <td style={{ padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar firstName={member.first_name} lastName={member.last_name} />
                      <div>
                        <div style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 500, fontSize: 14, color: '#111827',
                          lineHeight: 1.3,
                        }}>
                          {member.first_name} {member.last_name}
                        </div>
                        <div style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 11, color: '#9CA3AF', marginTop: 2,
                        }}>
                          {formatMemberNumber(member.member_number)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td style={{ padding: '0 16px' }}>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#374151',
                    }}>
                      {member.email ?? '—'}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 12, color: '#9CA3AF', marginTop: 2,
                    }}>
                      {member.phone ?? '—'}
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '0 16px' }}>
                    <StatusBadge status={member.membership_status} />
                  </td>

                  {/* Branch */}
                  <td style={{ padding: '0 16px' }}>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#374151',
                    }}>
                      {member.branches?.name ?? '—'}
                    </span>
                  </td>

                  {/* Ministry */}
                  <td style={{ padding: '0 16px' }}>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#374151',
                    }}>
                      {member.group_memberships?.[0]?.groups?.ministries?.name ?? '—'}
                    </span>
                  </td>

                  {/* Arrow */}
                  <td style={{ padding: '0 12px' }}>
                    <span
                      className="row-arrow"
                      style={{
                        color: '#9CA3AF',
                        opacity: 0,
                        transition: 'opacity 0.1s',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ArrowRightIcon />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '0.5px solid #E5E7EB',
          }}>
            <span style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: '#6B7280',
            }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} members
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  height: 38, padding: '0 14px', borderRadius: 8,
                  border: '0.5px solid #E5E7EB', background: '#fff',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#D1D5DB' : '#374151',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <ChevronIcon dir="left" /> Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  height: 38, padding: '0 14px', borderRadius: 8,
                  border: '0.5px solid #E5E7EB', background: '#fff',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#D1D5DB' : '#374151',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                Next <ChevronIcon dir="right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

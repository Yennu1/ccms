import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'transferred' | 'deceased'

interface Member {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
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
  transferred: { bg: '#EEF2FF', color: '#4338CA', label: 'Transferred' },
  deceased:    { bg: '#FEE2E2', color: '#991B1B', label: 'Deceased' },
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

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

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3.5" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.25" fill="currentColor" />
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

function ActionMenu({
  member,
  onClose,
}: {
  member: Member
  onClose: () => void
}) {
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const item = (label: string, onClick: () => void, color?: string) => (
    <button
      key={label}
      onClick={() => { onClick(); onClose() }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '8px 14px',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 13, color: color ?? '#111827',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  )

  const toggleLabel = member.membership_status === 'active' ? 'Deactivate' : 'Activate'

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 8, top: '100%', zIndex: 50,
      background: '#fff', border: '0.5px solid #E5E7EB',
      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      minWidth: 160, padding: '4px 0',
    }}>
      {item('View profile', () => navigate(`/members/${member.id}`))}
      {item('Edit member', () => navigate(`/members/${member.id}/edit`))}
      {item(toggleLabel, () => { /* handled by parent later */ })}
      <div style={{ height: '0.5px', background: '#E5E7EB', margin: '4px 0' }} />
      {item('Delete member', () => { /* handled by parent later */ }, '#EF4444')}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MembersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all')
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q) ||
      (m.member_number ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || m.membership_status === statusFilter
    return matchesSearch && matchesStatus
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

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .member-row:hover { background: #F9FAFB !important; }
        .member-row:hover .row-actions { opacity: 1 !important; }
        .filter-input:focus { border-color: #4F6BED !important; }
        .filter-select:focus { border-color: #4F6BED !important; outline: none; }
        .dots-btn:hover { background: #F3F4F6 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
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
            Manage your church members
          </p>
        </div>
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

      {/* Filter Bar */}
      <div style={{
        background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            className="filter-input"
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 280, paddingLeft: 34, paddingRight: 12 }}
          />
        </div>

        {/* Dropdowns */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
            <option value="deceased">Deceased</option>
          </select>

          <select
            className="filter-select"
            style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
          >
            <option>All Branches</option>
          </select>
        </div>
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
              <th style={{ ...th, width: 48 }}></th>
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

                  {/* Actions */}
                  <td style={{ padding: '0 8px', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <button
                        className="dots-btn row-actions"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === member.id ? null : member.id) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#9CA3AF', borderRadius: 6,
                          width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: openMenuId === member.id ? 1 : 0,
                          transition: 'opacity 0.1s, background 0.1s',
                        }}
                      >
                        <DotsIcon />
                      </button>
                      {openMenuId === member.id && (
                        <ActionMenu
                          member={member}
                          onClose={() => setOpenMenuId(null)}
                        />
                      )}
                    </div>
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

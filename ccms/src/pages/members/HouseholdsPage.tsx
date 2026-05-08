import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HouseholdMember {
  id: string
  first_name: string
  last_name: string
}

interface Household {
  id: string
  org_id: string
  name: string
  address: string | null
  city: string | null
  created_at: string
  branches: { id: string; name: string } | null
  head_member: HouseholdMember | null
}

interface Branch {
  id: string
  name: string
}

type SortBy = 'az' | 'za' | 'most_members' | 'recent'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ─── Icons ────────────────────────────────────────────────────────────────────

function HouseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1.5 7.5L8 2l6.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6.5V13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="9.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%',
      background: '#E8ECF9', color: '#4F6BED',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
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
          <div style={{ ...pulse, width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ ...pulse, width: 130, height: 13, marginBottom: 4 }} />
            <div style={{ ...pulse, width: 100, height: 11 }} />
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...pulse, width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ ...pulse, width: 110, height: 13 }} />
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 72, height: 20 }} /></td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 80, height: 13 }} /></td>
      <td style={{ padding: '10px 16px' }}><div style={{ ...pulse, width: 20, height: 20 }} /></td>
    </tr>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={5}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 80, gap: 12,
        }}>
          <div style={{ color: '#E5E7EB' }}>
            <HouseIcon size={48} />
          </div>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 16, color: '#111827',
          }}>
            No households yet
          </div>
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#9CA3AF',
          }}>
            Group your members into family units
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
            <PlusIcon /> Add Household
          </button>
        </div>
      </td>
    </tr>
  )
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export function HouseholdsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [households, setHouseholds] = useState<Household[]>([])
  const [countMap, setCountMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])

  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [page, setPage] = useState(1)
  const fetchHouseholds = async () => {
    if (!user?.org_id) return
    setLoading(true)
    setError(null)

    const [{ data, error: err }, { data: memberCounts }] = await Promise.all([
      supabase
        .from('households')
        .select(`
          *,
          branches(id, name),
          head_member:members!households_head_member_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq('org_id', user.org_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('members')
        .select('household_id')
        .eq('org_id', user.org_id)
        .not('household_id', 'is', null),
    ])

    if (err) {
      setError(err.message)
    } else {
      setHouseholds((data as unknown as Household[]) ?? [])
      const map = memberCounts?.reduce((acc, m) => {
        if (m.household_id) acc[m.household_id] = (acc[m.household_id] || 0) + 1
        return acc
      }, {} as Record<string, number>) ?? {}
      setCountMap(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHouseholds()
  }, [user?.org_id])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id)
      .then(({ data }) => { if (data) setBranches(data) })
  }, [user?.org_id])

  useEffect(() => { setPage(1) }, [search, branchFilter, sortBy])

  const filtered = households.filter(h => {
    const q = search.toLowerCase()
    const matchesSearch = !q || h.name.toLowerCase().includes(q) ||
      (h.head_member ? `${h.head_member.first_name} ${h.head_member.last_name}`.toLowerCase().includes(q) : false)
    const matchesBranch = branchFilter === 'all' || h.branches?.id === branchFilter
    return matchesSearch && matchesBranch
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'az': return a.name.localeCompare(b.name)
      case 'za': return b.name.localeCompare(a.name)
      case 'most_members': return (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0)
      case 'recent': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default: return 0
    }
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalMemberCount = Object.values(countMap).reduce((sum, c) => sum + c, 0)

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
        .hh-row:hover { background: #F9FAFB !important; }
        .hh-row:hover .row-arrow { opacity: 1 !important; }
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
            Households
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 0,
          }}>
            {loading
              ? 'Loading…'
              : `${households.length} households · grouped from ${totalMemberCount} members`}
          </p>
        </div>
        <button
          onClick={() => navigate('/members/households/new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#4F6BED', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            height: 38, padding: '0 16px',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 500, fontSize: 13, flexShrink: 0,
          }}
        >
          <PlusIcon /> Add Household
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '0.5px solid #E5E7EB',
        marginBottom: 16,
      }}>
        <button
          onClick={() => navigate('/members')}
          style={{
            ...tabBase,
            color: '#6B7280',
            borderBottom: '2px solid transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
        >
          All Members
        </button>
        <button
          style={{
            ...tabBase,
            color: '#4F6BED',
            borderBottom: '2px solid #4F6BED',
          }}
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
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            className="filter-input"
            type="text"
            placeholder="Search households..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>

        <select
          className="filter-select"
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="all">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <option value="recent">Recently Added</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="most_members">Most Members</option>
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
          Failed to load households: {error}
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
              <th style={th}>Household</th>
              <th style={th}>Head of Household</th>
              <th style={th}>Members</th>
              <th style={th}>Branch</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : paginated.length === 0 ? (
              <EmptyState onAdd={() => navigate('/members/households/new')} />
            ) : (
              paginated.map(household => (
                <tr
                  key={household.id}
                  className="hh-row"
                  onClick={() => navigate(`/members/households/${household.id}`)}
                  style={{
                    borderBottom: '0.5px solid #F3F4F6',
                    height: 60, background: '#fff',
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                >
                  {/* Household name + address */}
                  <td style={{ padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: '#F0F1F7', color: '#4F6BED',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <HouseIcon size={15} />
                      </div>
                      <div>
                        <div style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 500, fontSize: 14, color: '#111827',
                          lineHeight: 1.3,
                        }}>
                          {household.name}
                        </div>
                        {(household.address || household.city) && (
                          <div style={{
                            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                            fontSize: 12, color: '#9CA3AF', marginTop: 2,
                          }}>
                            {[household.address, household.city].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Head of Household */}
                  <td style={{ padding: '0 16px' }}>
                    {household.head_member ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar
                          firstName={household.head_member.first_name}
                          lastName={household.head_member.last_name}
                        />
                        <span style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontSize: 13, color: '#374151',
                        }}>
                          {household.head_member.first_name} {household.head_member.last_name}
                        </span>
                      </div>
                    ) : (
                      <span style={{
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontSize: 13, color: '#9CA3AF',
                      }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Members count */}
                  <td style={{ padding: '0 16px' }}>
                    <span style={{
                      background: '#E8ECF9', color: '#4F6BED',
                      borderRadius: 5, padding: '2px 8px',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}>
                      {countMap[household.id] ?? 0} members
                    </span>
                  </td>

                  {/* Branch */}
                  <td style={{ padding: '0 16px' }}>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#374151',
                    }}>
                      {household.branches?.name ?? '—'}
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
        {!loading && sorted.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '0.5px solid #E5E7EB',
          }}>
            <span style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: '#6B7280',
            }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} households
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

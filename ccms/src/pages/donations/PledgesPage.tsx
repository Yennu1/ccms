import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type PledgeStatus = 'active' | 'fulfilled' | 'overdue' | 'cancelled'

interface PledgeRow {
  id: string
  total_amount: number
  amount_paid: number
  due_date: string | null
  status: PledgeStatus
  created_at: string
  transaction_categories: { id: string; name: string } | null
  member: { id: string; first_name: string; last_name: string; member_number: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PledgeStatus, { bg: string; color: string; dot: string; label: string }> = {
  active:    { bg: '#DBEAFE', color: '#1E40AF', dot: '#60A5FA', label: 'Active' },
  fulfilled: { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'Fulfilled' },
  overdue:   { bg: '#FEE2E2', color: '#991B1B', dot: '#F87171', label: 'Overdue' },
  cancelled: { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'Cancelled' },
}

const AVATAR_PALETTE = [
  { bg: '#E8ECF9', color: '#4F6BED' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F0FDFA', color: '#0F766E' },
  { bg: '#F5F3FF', color: '#7C3AED' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(firstName: string, lastName: string) {
  const str = (firstName + lastName).toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDueDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ paid, total, status }: { paid: number; total: number; status: PledgeStatus }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const color = status === 'fulfilled' || pct >= 100
    ? '#22C55E'
    : status === 'overdue'
      ? '#EF4444'
      : '#4F6BED'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 5, borderRadius: 999,
          background: '#F3F4F6', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 999,
            background: color, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, color: '#6B7280', flexShrink: 0,
        }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
        {formatAmount(paid)} / {formatAmount(total)}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '0.5px solid var(--dm-border-soft)', height: 60 }}>
      {[22, 18, 28, 10, 10, 5].map((w, i) => (
        <td key={i} style={{ padding: '0 18px' }}>
          <div style={{
            height: 12, width: `${w * 4}px`, borderRadius: 6,
            background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PledgesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pledges,  setPledges]  = useState<PledgeRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PledgeStatus>('all')

  useEffect(() => {
    if (!user?.org_id) return
    const fetchPledges = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('pledges')
        .select(`
          id, total_amount, amount_paid, due_date, status, created_at,
          transaction_categories(id, name),
          member:members!pledges_member_id_fkey(id, first_name, last_name, member_number)
        `)
        .eq('org_id', user.org_id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Failed to load pledges')
      } else {
        setPledges((data ?? []) as unknown as PledgeRow[])
      }
      setLoading(false)
    }
    fetchPledges()
  }, [user?.org_id])

  const filtered = pledges.filter(p => {
    const firstName = p.member?.first_name ?? ''
    const lastName  = p.member?.last_name ?? ''
    const memberNum = p.member?.member_number ?? ''
    const catName   = p.transaction_categories?.name ?? ''
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      `${firstName} ${lastName}`.toLowerCase().includes(q) ||
      memberNum.toLowerCase().includes(q) ||
      catName.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const today = new Date().toISOString().split('T')[0]
  const totalPledged   = pledges.reduce((s, p) => s + p.total_amount, 0)
  const totalPaid      = pledges.reduce((s, p) => s + p.amount_paid, 0)
  const activePledges  = pledges.filter(p => p.status === 'active').length
  const overduePledges = pledges.filter(p => p.status === 'active' && p.due_date && p.due_date < today).length
  const fulfilledPledges = pledges.filter(p => p.status === 'fulfilled').length

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const th: React.CSSProperties = {
    padding: '11px 18px',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 10.5,
    color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: '0.5px solid var(--dm-border-soft)',
    background: 'var(--dm-bg-surface)', whiteSpace: 'nowrap',
  }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .pl-row:hover { background: var(--dm-bg-muted) !important; }
        .pl-row:hover .pl-actions { opacity: 1 !important; }
        .pl-filter-select:focus { border-color: #4F6BED !important; outline: none; }
        .pl-filter-input:focus { border-color: #4F6BED !important; }
        .pl-icon:hover { background: var(--dm-bg-muted) !important; color: var(--dm-text-ink) !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 22, color: 'var(--dm-text-ink)',
            letterSpacing: '-0.015em', margin: '0 0 4px',
          }}>
            Pledges
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading ? 'Loading…' : `${activePledges} active · ${overduePledges} overdue · ${fulfilledPledges} fulfilled`}
          </div>
        </div>
        <button
          onClick={() => navigate('/donations/pledges/new')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 16px', borderRadius: 8,
            border: 'none', background: '#4F6BED', color: '#fff',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Add Pledge
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 20 }}>
        {[
          { label: 'Transactions', active: false, onClick: () => navigate('/donations') },
          { label: 'Pledges', active: true, onClick: () => {} },
          { label: 'Categories', active: false, onClick: () => toast.info('Categories coming soon') },
        ].map(tab => (
          <button
            key={tab.label}
            onClick={tab.onClick}
            style={{
              padding: '10px 14px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13,
              color: tab.active ? '#4F6BED' : '#6B7280',
              borderBottom: tab.active ? '2px solid #4F6BED' : '2px solid transparent',
              marginBottom: -1,
              background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.12s',
            }}
            onMouseEnter={e => { if (!tab.active) e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (!tab.active) e.currentTarget.style.color = '#6B7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Pledged',  value: loading ? '—' : formatAmount(totalPledged),  sub: `${pledges.length} pledges`,                              color: '#4F6BED', bgIcon: '#EEF1FE' },
          { label: 'Total Paid',     value: loading ? '—' : formatAmount(totalPaid),     sub: totalPledged > 0 ? `${Math.round((totalPaid / totalPledged) * 100)}% of pledges` : '—',  color: '#22C55E', bgIcon: '#DCFCE7' },
          { label: 'Active Pledges', value: loading ? '—' : String(activePledges),        sub: 'In progress',                                             color: '#3B82F6', bgIcon: '#DBEAFE' },
          { label: 'Overdue',        value: loading ? '—' : String(overduePledges),       sub: 'Need follow-up',                                          color: '#EF4444', bgIcon: '#FEE2E2' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
            borderRadius: 12, padding: '16px 18px',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#6B7280', marginBottom: 10,
            }}>
              {c.label}
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 700, fontSize: 22, color: 'var(--dm-text-ink)',
              letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums',
              marginBottom: 4,
            }}>
              {c.value}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10,
        padding: 14, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="pl-filter-input"
            type="text"
            placeholder="Search pledges..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>
        <select
          className="pl-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="pl-filter-select" style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option>All Categories</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '22%' }}>Member</th>
              <th style={th}>Category</th>
              <th style={{ ...th, width: '28%' }}>Progress</th>
              <th style={th}>Due Date</th>
              <th style={th}>Status</th>
              <th style={{ ...th, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{
                  padding: '60px 0', textAlign: 'center',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13,
                }}>
                  {pledges.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
                        No pledges recorded yet.
                      </div>
                      <button
                        onClick={() => navigate('/donations/pledges/new')}
                        style={{
                          marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8,
                          height: 36, padding: '0 16px', borderRadius: 8,
                          border: 'none', background: '#4F6BED', color: '#fff',
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        Add Pledge
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>No pledges match your filters.</span>
                  )}
                </td>
              </tr>
            ) : filtered.map(p => {
              const firstName = p.member?.first_name ?? '—'
              const lastName  = p.member?.last_name ?? ''
              const memberNum = p.member?.member_number ?? '—'
              const { bg: avBg, color: avColor } = getAvatarColor(firstName, lastName)
              const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.active
              return (
                <tr
                  key={p.id}
                  className="pl-row"
                  style={{
                    borderBottom: '0.5px solid var(--dm-border-soft)',
                    height: 60, background: 'var(--dm-bg-card)',
                    transition: 'background 0.1s', cursor: 'default',
                  }}
                >
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: avBg, color: avColor,
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontWeight: 700, fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {firstName[0]}{lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)' }}>
                          {firstName} {lastName}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                          {memberNum}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)' }}>
                      {p.transaction_categories?.name ?? '—'}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-body)', marginTop: 2 }}>
                      {p.id.slice(0, 8).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <ProgressBar paid={p.amount_paid} total={p.total_amount} status={p.status} />
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>
                      {formatDueDate(p.due_date)}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 999,
                      background: st.bg, color: st.color,
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 600, fontSize: 11.5,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    <div className="pl-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, opacity: 1 }}>
                      <button
                        className="pl-icon"
                        aria-label="Edit pledge"
                        onClick={e => { e.stopPropagation(); navigate(`/donations/pledges/${p.id}/edit`) }}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
                          display: 'grid', placeItems: 'center',
                          color: 'var(--dm-text-secondary)', cursor: 'pointer',
                          transition: 'all 0.1s',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" 
                            stroke="currentColor" strokeWidth="1.3" 
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', color: '#6B7280', fontSize: 12.5,
          borderTop: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {filtered.length} pledge{filtered.length !== 1 ? 's' : ''} shown
        </div>
      </div>
    </>
  )
}

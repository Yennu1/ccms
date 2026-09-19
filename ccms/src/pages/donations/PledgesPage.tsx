import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSidebar } from '../../contexts/SidebarContext'
import { MemberAvatar } from '../../components/MemberAvatar'
import { PledgeDetailPanel, type PledgePanelData } from '../../components/PledgeDetailPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type PledgeStatus = 'active' | 'fulfilled' | 'overdue' | 'cancelled'

interface PledgeRow {
  id: string
  total_amount: number
  amount_paid: number
  due_date: string | null
  status: PledgeStatus
  notes: string | null
  created_at: string
  transaction_categories: { id: string; name: string } | null
  member: {
    id: string
    first_name: string
    last_name: string
    member_number: string
    photo_url: string | null
  } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Single grey tray + a small coloured dot per state.
const STATUS_META: Record<PledgeStatus, { label: string; dot: string }> = {
  active:    { label: 'Active',    dot: '#6B7280' },
  fulfilled: { label: 'Fulfilled', dot: '#22C55E' },
  overdue:   { label: 'Overdue',   dot: '#DC2626' },
  cancelled: { label: 'Cancelled', dot: '#9CA3AF' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFullDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Two colours only:
 *  - green while paid ≤ total
 *  - red when paid > total (overflow)
 * The bar itself caps visually at 100%.
 */
function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const rawPct = total > 0 ? (paid / total) * 100 : 0
  const displayPct = Math.min(100, rawPct)
  const isOverflow = rawPct > 100
  const color = isOverflow ? '#DC2626' : '#22C55E'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        height: 6, borderRadius: 999,
        background: 'var(--dm-bg-muted)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${displayPct}%`, borderRadius: 999,
          background: color, transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12, color: 'var(--dm-text-ink)', fontWeight: 500,
      }}>
        {formatAmount(paid)} / {formatAmount(total)} · {Math.round(rawPct)}%
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: PledgeStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.active
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 6,
      background: '#EEF0F5', color: '#111827',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500, fontSize: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: meta.dot, flexShrink: 0,
      }} />
      {meta.label}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '0.5px solid var(--dm-border-soft)', height: 60 }}>
      {[22, 18, 28, 10, 10, 5].map((w, i) => (
        <td key={i} style={{ padding: '0 18px' }}>
          <div style={{
            height: 12, width: `${w * 4}px`, borderRadius: 6,
            background: 'var(--dm-bg-muted)', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Row-level overflow menu (Edit / Delete) ─────────────────────────────────

function RowMenu({
  onEdit, onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        aria-label="More actions"
        onClick={() => setOpen(v => !v)}
        style={{
          width: 30, height: 30, borderRadius: 6,
          border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
          display: 'grid', placeItems: 'center',
          color: 'var(--dm-text-secondary)', cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="3" r="1.2" fill="currentColor" />
          <circle cx="7" cy="7" r="1.2" fill="currentColor" />
          <circle cx="7" cy="11" r="1.2" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40,
          minWidth: 140, background: 'var(--dm-bg-card)',
          border: '0.5px solid var(--dm-border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
          padding: 4, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          <button
            onClick={() => { setOpen(false); onEdit() }}
            style={menuItemStyle()}
          >
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete() }}
            style={{ ...menuItemStyle(), color: '#DC2626' }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 10px', borderRadius: 6, border: 'none',
    background: 'transparent', cursor: 'pointer',
    fontSize: 13, color: 'var(--dm-text-ink)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PledgesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isMobile, isTablet } = useSidebar()

  const [pledges,  setPledges]  = useState<PledgeRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PledgeStatus>('all')

  const [activePledge, setActivePledge]     = useState<PledgePanelData | null>(null)
  const [autoDeletePrompt, setAutoDeletePrompt] = useState(false)

  const fetchPledges = useCallback(async () => {
    if (!user?.org_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('pledges')
      .select(`
        id, total_amount, amount_paid, due_date, status, notes, created_at,
        transaction_categories(id, name),
        member:members!pledges_member_id_fkey(id, first_name, last_name, member_number, photo_url)
      `)
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load pledges')
    } else {
      setPledges((data ?? []) as unknown as PledgeRow[])
    }
    setLoading(false)
  }, [user?.org_id])

  useEffect(() => { fetchPledges() }, [fetchPledges])

  // Keep the open panel's data in sync when the list refreshes
  useEffect(() => {
    if (!activePledge) return
    const fresh = pledges.find(p => p.id === activePledge.id)
    if (!fresh) { setActivePledge(null); return }
    setActivePledge(rowToPanelData(fresh))
     
  }, [pledges])

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

  const openPledge = (p: PledgeRow) => {
    setAutoDeletePrompt(false)
    setActivePledge(rowToPanelData(p))
  }

  const askDelete = (p: PledgeRow) => {
    setActivePledge(rowToPanelData(p))
    setAutoDeletePrompt(true)
  }

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

  const emptyState = pledges.length === 0 ? (
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
  )

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .pl-row { cursor: pointer; }
        .pl-row:hover { background: var(--dm-bg-muted) !important; }
        .pl-filter-select:focus { border-color: #4F6BED !important; outline: none; }
        .pl-filter-input:focus { border-color: #4F6BED !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: isMobile ? 12 : 20, marginBottom: 20 }}>
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
          { label: 'Expenses', active: false, onClick: () => navigate('/donations/expenses') },
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Pledged',  value: loading ? '—' : formatAmount(totalPledged),  sub: `${pledges.length} pledges` },
          { label: 'Total Paid',     value: loading ? '—' : formatAmount(totalPaid),     sub: totalPledged > 0 ? `${Math.round((totalPaid / totalPledged) * 100)}% of pledges` : '—' },
          { label: 'Active Pledges', value: loading ? '—' : String(activePledges),        sub: 'In progress' },
          { label: 'Overdue',        value: loading ? '—' : String(overduePledges),       sub: 'Need follow-up' },
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
        display: isMobile ? 'flex' : 'grid',
        flexWrap: isMobile ? 'wrap' : undefined,
        gridTemplateColumns: isMobile ? undefined : '1.5fr 1fr 1fr', gap: 10,
        padding: 14, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? '100%' : undefined }}>
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
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', width: isMobile ? '100%' : undefined }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="pl-filter-select" style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', width: isMobile ? '100%' : undefined }}>
          <option>All Categories</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, display: isMobile ? 'none' : undefined }}>
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
                  {emptyState}
                </td>
              </tr>
            ) : filtered.map(p => {
              const firstName = p.member?.first_name ?? '—'
              const lastName  = p.member?.last_name ?? ''
              const memberNum = p.member?.member_number ?? '—'
              return (
                <tr
                  key={p.id}
                  className="pl-row"
                  onClick={() => openPledge(p)}
                  style={{
                    borderBottom: '0.5px solid var(--dm-border-soft)',
                    height: 68, background: 'var(--dm-bg-card)',
                    transition: 'background 0.1s',
                  }}
                >
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <MemberAvatar
                        firstName={firstName}
                        lastName={lastName}
                        photoUrl={p.member?.photo_url ?? null}
                        size={36}
                      />
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)' }}>
                          {firstName} {lastName}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-secondary)', marginTop: 2 }}>
                          {memberNum}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)' }}>
                      {p.transaction_categories?.name ?? '—'}
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <ProgressBar paid={p.amount_paid} total={p.total_amount} />
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: 'var(--dm-text-body)' }}>
                      {formatFullDate(p.due_date)}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <StatusPill status={p.status} />
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <RowMenu
                        onEdit={() => navigate(`/donations/pledges/${p.id}/edit`)}
                        onDelete={() => askDelete(p)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile card list */}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <>{[1, 2, 3].map(i => (
                <div key={i} style={{ height: 118, borderRadius: 10, background: 'var(--dm-bg-muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}</>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13 }}>
                {emptyState}
              </div>
            ) : (
              filtered.map(p => {
                const firstName = p.member?.first_name ?? '—'
                const lastName  = p.member?.last_name ?? ''
                const memberNum = p.member?.member_number ?? '—'
                return (
                  <div
                    key={p.id}
                    onClick={() => openPledge(p)}
                    style={{
                      background: 'var(--dm-bg-card)',
                      border: '0.5px solid var(--dm-border-soft)',
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <MemberAvatar
                          firstName={firstName}
                          lastName={lastName}
                          photoUrl={p.member?.photo_url ?? null}
                          size={40}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>
                            {firstName} {lastName}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-secondary)', marginTop: 2 }}>
                            {memberNum}
                          </div>
                        </div>
                      </div>
                      <StatusPill status={p.status} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <ProgressBar paid={p.amount_paid} total={p.total_amount} />
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--dm-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)' }}>
                        {p.transaction_categories?.name ?? '—'}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
                        {formatFullDate(p.due_date)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 18px', color: '#6B7280', fontSize: 12.5,
          borderTop: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {filtered.length} pledge{filtered.length !== 1 ? 's' : ''} shown
        </div>
      </div>

      {/* Side panel */}
      <PledgeDetailPanel
        pledge={activePledge}
        openDeletePrompt={autoDeletePrompt}
        onClose={() => { setActivePledge(null); setAutoDeletePrompt(false) }}
        onChanged={fetchPledges}
      />
    </>
  )
}

// ─── Row → Panel data mapping ────────────────────────────────────────────────

function rowToPanelData(p: PledgeRow): PledgePanelData {
  return {
    id: p.id,
    total_amount: p.total_amount,
    amount_paid: p.amount_paid,
    due_date: p.due_date,
    status: p.status,
    notes: p.notes,
    category: p.transaction_categories,
    member: p.member,
  }
}

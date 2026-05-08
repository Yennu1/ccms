import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type PledgeStatus = 'active' | 'fulfilled' | 'overdue' | 'cancelled'

interface Pledge {
  id: string
  firstName: string
  lastName: string
  memberNumber: string
  description: string
  totalPledged: number
  amountPaid: number
  startDate: string
  dueDate: string
  status: PledgeStatus
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

function getAvatarColor(firstName: string, lastName: string) {
  const str = (firstName + lastName).toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SAMPLE_PLEDGES: Pledge[] = [
  {
    id: 'PLG-001', firstName: 'Kwame', lastName: 'Asante', memberNumber: 'GH-00001',
    description: 'Building Fund Pledge', totalPledged: 5000, amountPaid: 3500,
    startDate: 'Jan 2026', dueDate: 'Dec 2026', status: 'active',
  },
  {
    id: 'PLG-002', firstName: 'Abena', lastName: 'Mensah', memberNumber: 'GH-00002',
    description: 'Annual Tithe Pledge', totalPledged: 2400, amountPaid: 2400,
    startDate: 'Jan 2026', dueDate: 'Dec 2026', status: 'fulfilled',
  },
  {
    id: 'PLG-003', firstName: 'Kofi', lastName: 'Boateng', memberNumber: 'GH-00003',
    description: 'Building Fund Pledge', totalPledged: 10000, amountPaid: 2000,
    startDate: 'Mar 2025', dueDate: 'Feb 2026', status: 'overdue',
  },
  {
    id: 'PLG-004', firstName: 'Ama', lastName: 'Owusu', memberNumber: 'GH-00004',
    description: 'Welfare Fund Pledge', totalPledged: 1200, amountPaid: 600,
    startDate: 'Feb 2026', dueDate: 'Jul 2026', status: 'active',
  },
  {
    id: 'PLG-005', firstName: 'Emmanuel', lastName: 'Darko', memberNumber: 'GH-00005',
    description: 'Special Offering Pledge', totalPledged: 500, amountPaid: 0,
    startDate: 'Apr 2026', dueDate: 'Jun 2026', status: 'cancelled',
  },
  {
    id: 'PLG-006', firstName: 'Akosua', lastName: 'Frimpong', memberNumber: 'GH-00006',
    description: 'Building Fund Pledge', totalPledged: 3000, amountPaid: 3000,
    startDate: 'Jan 2026', dueDate: 'Jun 2026', status: 'fulfilled',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const color = pct >= 100 ? '#22C55E' : pct < 30 ? '#EF4444' : '#4F6BED'
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
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, color: '#9CA3AF',
      }}>
        {formatAmount(paid)} / {formatAmount(total)}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PledgesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PledgeStatus>('all')

  const filtered = SAMPLE_PLEDGES.filter(p => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.memberNumber.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPledged   = SAMPLE_PLEDGES.reduce((s, p) => s + p.totalPledged, 0)
  const totalPaid      = SAMPLE_PLEDGES.reduce((s, p) => s + p.amountPaid, 0)
  const activePledges  = SAMPLE_PLEDGES.filter(p => p.status === 'active').length
  const overduePledges = SAMPLE_PLEDGES.filter(p => p.status === 'overdue').length
  const fulfilledPledges = SAMPLE_PLEDGES.filter(p => p.status === 'fulfilled').length

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const th: React.CSSProperties = {
    padding: '11px 18px',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 10.5,
    color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: '0.5px solid #EFF1F7',
    background: '#FAFBFE', whiteSpace: 'nowrap',
  }

  return (
    <>
      <style>{`
        .pl-row:hover { background: #FAFBFE !important; }
        .pl-row:hover .pl-actions { opacity: 1 !important; }
        .pl-filter-select:focus { border-color: #4F6BED !important; outline: none; }
        .pl-filter-input:focus { border-color: #4F6BED !important; }
        .pl-icon:hover { background: #FAFBFE !important; color: #111827 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 22, color: '#111827',
            letterSpacing: '-0.015em', margin: '0 0 4px',
          }}>
            Pledges
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {activePledges} active · {overduePledges} overdue · {fulfilledPledges} fulfilled
          </div>
        </div>
        <button
          onClick={() => toast.info('Record pledge feature coming soon')}
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
          Record Pledge
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
          { label: 'Total Pledged',   value: formatAmount(totalPledged),   sub: `${SAMPLE_PLEDGES.length} pledges`,       color: '#4F6BED', bgIcon: '#EEF1FE' },
          { label: 'Total Paid',      value: formatAmount(totalPaid),       sub: `${Math.round((totalPaid / totalPledged) * 100)}% of pledges`,  color: '#22C55E', bgIcon: '#DCFCE7' },
          { label: 'Active Pledges',  value: String(activePledges),          sub: 'In progress',                           color: '#3B82F6', bgIcon: '#DBEAFE' },
          { label: 'Overdue',         value: String(overduePledges),         sub: 'Need follow-up',                        color: '#EF4444', bgIcon: '#FEE2E2' },
        ].map(c => (
          <div key={c.label} style={{
            background: '#fff', border: '0.5px solid #E6E8F0',
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
              fontWeight: 700, fontSize: 22, color: '#111827',
              letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums',
              marginBottom: 4,
            }}>
              {c.value}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 12, color: '#9CA3AF',
            }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10,
        padding: 14, background: '#fff', border: '0.5px solid #E5E7EB',
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
          <option>All Branches</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '22%' }}>Member</th>
              <th style={th}>Description</th>
              <th style={{ ...th, width: '28%' }}>Progress</th>
              <th style={th}>Due Date</th>
              <th style={th}>Status</th>
              <th style={{ ...th, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{
                  padding: '60px 0', textAlign: 'center',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13, color: '#9CA3AF',
                }}>
                  No pledges match your filters.
                </td>
              </tr>
            ) : filtered.map(p => {
              const { bg: avBg, color: avColor } = getAvatarColor(p.firstName, p.lastName)
              const st = STATUS_STYLES[p.status]
              return (
                <tr
                  key={p.id}
                  className="pl-row"
                  style={{
                    borderBottom: '0.5px solid #EFF1F7',
                    height: 60, background: '#fff',
                    transition: 'background 0.1s', cursor: 'pointer',
                  }}
                  onClick={() => toast.info(`Pledge ${p.id} — coming soon`)}
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
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>
                          {p.firstName} {p.lastName}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                          {p.memberNumber}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151' }}>
                      {p.description}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {p.id}
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <ProgressBar paid={p.amountPaid} total={p.totalPledged} />
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>
                      {p.dueDate}
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
                    <div className="pl-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, opacity: 0, transition: 'opacity 0.1s' }}>
                      <button
                        className="pl-icon"
                        aria-label="More"
                        onClick={e => { e.stopPropagation(); toast.info('Actions coming soon') }}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          border: '0.5px solid #E5E7EB', background: '#fff',
                          display: 'grid', placeItems: 'center',
                          color: '#6B7280', cursor: 'pointer',
                          transition: 'all 0.1s',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <circle cx="3" cy="8" r="1.3" fill="currentColor" />
                          <circle cx="8" cy="8" r="1.3" fill="currentColor" />
                          <circle cx="13" cy="8" r="1.3" fill="currentColor" />
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
          borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {filtered.length} pledge{filtered.length !== 1 ? 's' : ''} shown
        </div>
      </div>
    </>
  )
}

import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'tithe' | 'offering' | 'building' | 'welfare' | 'thanksgiving' | 'special'
type DateRange = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all-time'
type CombinedFilter = 'all' | 'individual' | 'collective' | 'tithe' | 'offering' | 'sunday-offering' | 'pledge' | 'building' | 'thanksgiving' | 'harvest' | 'other'

interface TxRow {
  id: string
  member_id: string | null
  category_id: string | null
  amount: number
  payment_method: string
  transaction_date: string
  reference_number: string | null
  branch_id: string | null
  created_at: string
  is_collective: boolean
  transaction_categories: { id: string; name: string } | null
  member: { id: string; first_name: string; last_name: string; member_number: string } | null
  branches: { id: string; name: string } | null
  recorder: { full_name: string } | null
}

interface Branch { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const CATEGORY_STYLES: Record<Category, { bg: string; color: string; dot: string; label: string }> = {
  tithe:        { bg: '#FEF6E5', color: '#8A6418', dot: '#C8964A', label: 'Tithe' },
  offering:     { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'Offering' },
  building:     { bg: '#E8ECF9', color: '#3349C7', dot: '#7B93F5', label: 'Building Fund' },
  welfare:      { bg: '#EDE9FE', color: '#5B21B6', dot: '#8B5CF6', label: 'Welfare' },
  thanksgiving: { bg: '#FFE4E6', color: '#9F1239', dot: '#EF4444', label: 'Thanksgiving' },
  special:      { bg: '#FCE7F3', color: '#9D174D', dot: '#EC4899', label: 'Special Offering' },
}

const METHOD_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  cash:          { bg: '#F3F4F6', color: '#6B7280', label: 'Cash' },
  momo:          { bg: '#FEF3C7', color: '#92400E', label: 'MoMo' },
  bank:          { bg: '#EEF2FF', color: '#4338CA', label: 'Bank Transfer' },
  bank_transfer: { bg: '#EEF2FF', color: '#4338CA', label: 'Bank Transfer' },
  cheque:        { bg: '#F3E8FF', color: '#6B21A8', label: 'Cheque' },
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

function getCategoryKey(name: string): Category {
  const lower = (name ?? '').toLowerCase()
  if (lower === 'tithe') return 'tithe'
  if (lower === 'offering') return 'offering'
  if (lower.includes('building')) return 'building'
  if (lower === 'welfare') return 'welfare'
  if (lower === 'thanksgiving') return 'thanksgiving'
  if (lower.includes('special')) return 'special'
  return 'offering'
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', {
      month: 'short', day: '2-digit', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 2.5v8M5 5.5L8 2.5l3 3M3 11v1.5h10V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

function Avatar({ firstName, lastName, size = 32 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const { bg, color } = getAvatarColor(firstName, lastName)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 700, fontSize: size < 40 ? 11 : 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function CategoryPill({ categoryName }: { categoryName: string }) {
  const key = getCategoryKey(categoryName)
  const s = CATEGORY_STYLES[key]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function MethodPill({ method }: { method: string }) {
  const s = METHOD_STYLES[method] ?? METHOD_STYLES.cash
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '0.5px solid #EFF1F7', height: 56 }}>
      {[24, 14, 10, 12, 10, 10, 5].map((w, i) => (
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

function CollectiveAvatar({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#EDE9FE', color: '#8B5CF6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none">
        <circle cx="9.5" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M9.5 4.5v1.5l1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 10.5A5.5 5.5 0 0 1 9.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="13.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </div>
  )
}

function CollectiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: '#FEF6E5', color: '#8A6418',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8964A', flexShrink: 0 }} />
      Collective
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DonationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('this-month')
  const [combinedFilter, setCombinedFilter] = useState<CombinedFilter>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | string>('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!user?.org_id) return
    const fetchData = async () => {
      setLoading(true)
      const [txResult, branchResult] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id, member_id, category_id, amount, payment_method,
            transaction_date, reference_number, branch_id, created_at, is_collective,
            transaction_categories(id, name),
            member:members!transactions_member_id_fkey(id, first_name, last_name, member_number),
            branches(id, name),
            recorder:profiles!transactions_recorded_by_fkey(full_name)
          `)
          .eq('org_id', user.org_id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('branches')
          .select('id, name')
          .eq('org_id', user.org_id),
      ])

      if (txResult.error) {
        toast.error('Failed to load transactions')
      } else {
        setTransactions((txResult.data ?? []) as unknown as TxRow[])
      }

      if (!branchResult.error) {
        setBranches((branchResult.data ?? []) as Branch[])
      }

      setLoading(false)
    }
    fetchData()
  }, [user?.org_id])

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const thisMonthTx = useMemo(() =>
    transactions.filter(t => t.transaction_date >= startOfMonth),
    [transactions, startOfMonth]
  )
  const lastMonthTx = useMemo(() =>
    transactions.filter(t => t.transaction_date >= startOfLastMonth && t.transaction_date <= endOfLastMonth),
    [transactions, startOfLastMonth, endOfLastMonth]
  )

  const totalThisMonth = thisMonthTx.reduce((s, t) => s + t.amount, 0)
  const totalLastMonth = lastMonthTx.reduce((s, t) => s + t.amount, 0)
  const trendPct = totalLastMonth > 0
    ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
    : null
  const tithesThisMonth = thisMonthTx
    .filter(t => getCategoryKey(t.transaction_categories?.name ?? '') === 'tithe')
    .reduce((s, t) => s + t.amount, 0)
  const offeringsThisMonth = thisMonthTx
    .filter(t => getCategoryKey(t.transaction_categories?.name ?? '') === 'offering')
    .reduce((s, t) => s + t.amount, 0)
  const buildingFundThisMonth = thisMonthTx
    .filter(t => getCategoryKey(t.transaction_categories?.name ?? '') === 'building')
    .reduce((s, t) => s + t.amount, 0)

  const tithesPct = totalThisMonth > 0
    ? Math.round((tithesThisMonth / totalThisMonth) * 100)
    : 0

  // ─── Filtered + paginated ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let fromDate: string | null = null
    let toDate: string | null = null

    if (dateRange === 'this-month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    } else if (dateRange === 'last-month') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    } else if (dateRange === 'last-3-months') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0]
    } else if (dateRange === 'this-year') {
      fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    }

    return transactions.filter(t => {
      const q = search.toLowerCase()
      const memberName = t.member
        ? `${t.member.first_name} ${t.member.last_name}`.toLowerCase()
        : ''
      const ref = (t.reference_number ?? '').toLowerCase()
      const matchesSearch = !q || memberName.includes(q) || ref.includes(q) || t.id.toLowerCase().includes(q)

      const matchesDate =
        (!fromDate || t.transaction_date >= fromDate) &&
        (!toDate || t.transaction_date <= toDate)

      const catName = (t.transaction_categories?.name ?? '').toLowerCase()

      const pm = (t.payment_method ?? '').toLowerCase()
      const matchesMethod = methodFilter === 'all' ||
        pm === methodFilter ||
        (methodFilter === 'bank' && pm === 'bank_transfer')

      const matchesBranch = !branchFilter || t.branch_id === branchFilter

      const matchesCombined =
        combinedFilter === 'all' ||
        (combinedFilter === 'collective' && t.is_collective === true) ||
        (combinedFilter === 'individual' && !t.is_collective) ||
        (combinedFilter === 'tithe' && catName.includes('tithe')) ||
        (combinedFilter === 'offering' && catName === 'offering') ||
        (combinedFilter === 'sunday-offering' && catName.includes('sunday')) ||
        (combinedFilter === 'pledge' && catName.includes('pledge')) ||
        (combinedFilter === 'building' && catName.includes('building')) ||
        (combinedFilter === 'thanksgiving' && catName.includes('thanksgiving')) ||
        (combinedFilter === 'harvest' && catName.includes('harvest')) ||
        (combinedFilter === 'other' && !catName.includes('tithe') && catName !== 'offering' &&
          !catName.includes('sunday') && !catName.includes('pledge') &&
          !catName.includes('building') && !catName.includes('thanksgiving') && !catName.includes('harvest'))

      return matchesSearch && matchesDate && matchesMethod && matchesBranch && matchesCombined
    })
  }, [transactions, search, dateRange, combinedFilter, methodFilter, branchFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (!exportOpen) return
    function close(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const handleExportExcel = async () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No transactions to export')
      return
    }

    const XLSX = await import('xlsx')

    const rows = transactions.map(tx => ({
      'Date': tx.transaction_date,
      'Member Name': tx.member
        ? `${tx.member.first_name} ${tx.member.last_name}`
        : 'Anonymous',
      'Member No': tx.member?.member_number ?? '—',
      'Category': tx.transaction_categories?.name ?? '—',
      'Amount (GHS)': tx.amount,
      'Payment Method': tx.payment_method,
      'Reference': tx.reference_number ?? '—',
      'Branch': tx.branches?.name ?? '—',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    XLSX.writeFile(wb, `ccms-transactions-${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Exported as Excel successfully')
  }

  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No transactions to export')
      return
    }

    const headers = [
      'Date', 'Member Name', 'Member No',
      'Category', 'Amount (GHS)', 'Payment Method',
      'Reference', 'Branch', 'Recorded By'
    ]

    const rows = transactions.map(tx => [
      tx.transaction_date,
      tx.member
        ? `${tx.member.first_name} ${tx.member.last_name}`
        : 'Anonymous',
      tx.member?.member_number ?? '—',
      tx.transaction_categories?.name ?? '—',
      tx.amount.toFixed(2),
      tx.payment_method,
      tx.reference_number ?? '—',
      tx.branches?.name ?? '—',
      tx.recorder?.full_name ?? '—',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell =>
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ccms-transactions-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Transactions exported successfully')
  }

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827',
    background: '#fff', outline: 'none',
    transition: 'border-color 0.15s',
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .tx-row:hover { background: #FAFBFE !important; }
        .tx-row:hover .row-actions { opacity: 1 !important; }
        .filter-select-d:focus { border-color: #4F6BED !important; outline: none; }
        .filter-input-d:focus { border-color: #4F6BED !important; }
        .icon-mini:hover { background: #FAFBFE !important; color: #111827 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 22, color: '#111827',
            letterSpacing: '-0.015em', margin: '0 0 4px',
          }}>
            Donations
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading
              ? 'Loading…'
              : `${formatAmount(totalThisMonth)} collected this month · ${thisMonthTx.length} transactions`
            }
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(o => !o)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                height: 36, padding: '0 14px', borderRadius: 8,
                border: '0.5px solid #E5E7EB', background: exportOpen ? '#FAFBFE' : '#fff', color: '#374151',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <ExportIcon /> Export
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {exportOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: '#fff', border: '0.5px solid #E5E7EB',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                zIndex: 100, minWidth: 180, padding: '4px 0',
              }}>
                <button
                  onClick={() => { handleExport(); setExportOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '9px 14px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontSize: 13, color: '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => { handleExportExcel(); setExportOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '9px 14px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontSize: 13, color: '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Export as Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/donations/new')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 16px', borderRadius: 8,
              border: 'none', background: '#4F6BED', color: '#fff',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon /> Record Giving
          </button>
        </div>
      </div>

      {/* Stat Cards 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Total This Month */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 18px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280' }}>Total This Month</span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#EEF1FE', color: '#4F6BED', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M9.8 6.2A2.2 2.2 0 0 0 8 5.3c-1.2 0-2 .6-2 1.4 0 .9.8 1.2 2 1.5s2 .6 2 1.5-.8 1.4-2 1.4a2.2 2.2 0 0 1-1.8-.9M8 4.3v1M8 11.7v1" /></svg>
            </span>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : formatAmount(totalThisMonth)}
          </div>
          {trendPct !== null ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: trendPct >= 0 ? '#22C55E' : '#EF4444', background: trendPct >= 0 ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
              {trendPct >= 0 ? <UpIcon /> : <DownIcon />}
              {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(1)}% vs last month
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9CA3AF', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
              No prior month data
            </div>
          )}
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <path d="M0,28 L20,24 L40,26 L60,20 L80,22 L100,16 L120,18 L140,12 L160,14 L180,8 L200,6" fill="none" stroke="#4F6BED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,28 L20,24 L40,26 L60,20 L80,22 L100,16 L120,18 L140,12 L160,14 L180,8 L200,6 L200,36 L0,36 Z" fill="#4F6BED" opacity="0.08" />
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>
            Last month · {loading ? '—' : formatAmount(totalLastMonth)}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: '#4F6BED' }} />
        </div>

        {/* Tithes */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 18px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280' }}>Tithes</span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(200,150,74,.12)', color: '#C8964A', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13.5S2.5 10.2 2.5 6.4A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.5 1.4C13.5 10.2 8 13.5 8 13.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </span>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : formatAmount(tithesThisMonth)}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> {tithesPct}% of total
          </div>
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <path d="M0,26 L20,24 L40,22 L60,18 L80,20 L100,14 L120,16 L140,10 L160,12 L180,8 L200,6" fill="none" stroke="#C8964A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,26 L20,24 L40,22 L60,18 L80,20 L100,14 L120,16 L140,10 L160,12 L180,8 L200,6 L200,36 L0,36 Z" fill="#C8964A" opacity="0.10" />
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>{tithesPct}% of total contributions</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: '#C8964A' }} />
        </div>

        {/* Offerings */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 18px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280' }}>Offerings</span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(34,197,94,.10)', color: '#22C55E', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6 5h4M6 8h4M6 11h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </span>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : formatAmount(offeringsThisMonth)}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> This month
          </div>
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <path d="M0,12 L20,16 L40,14 L60,20 L80,18 L100,22 L120,20 L140,24 L160,22 L180,26 L200,24" fill="none" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,12 L20,16 L40,14 L60,20 L80,18 L100,22 L120,20 L140,24 L160,22 L180,26 L200,24 L200,36 L0,36 Z" fill="#22C55E" opacity="0.10" />
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>Sunday &amp; midweek combined</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: '#22C55E' }} />
        </div>

        {/* Building Fund */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 18px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280' }}>Building Fund</span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(123,147,245,.14)', color: '#7B93F5', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 14c-2.5 0-4-1.5-4-3.5 0-2 1.5-3 1.5-4.5 0 1.5 1 2 1 2S6 4 8 2c0 3 3 4 3 7C11 11.5 10 14 8 14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </span>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : formatAmount(buildingFundThisMonth)}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> This month
          </div>
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <g fill="#7B93F5" opacity="0.85">
              <rect x="6" y="22" width="14" height="12" rx="2" />
              <rect x="32" y="14" width="14" height="20" rx="2" />
              <rect x="58" y="20" width="14" height="14" rx="2" />
              <rect x="84" y="10" width="14" height="24" rx="2" />
              <rect x="110" y="18" width="14" height="16" rx="2" />
              <rect x="136" y="6" width="14" height="28" rx="2" />
              <rect x="162" y="12" width="14" height="22" rx="2" />
            </g>
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>Building fund contributions</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: '#7B93F5' }} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 20 }}>
        {[
          { label: 'Transactions', active: true, onClick: () => {} },
          { label: 'Pledges', active: false, onClick: () => navigate('/donations/pledges') },
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
              background: 'none',
              cursor: 'pointer', transition: 'color 0.12s',
            }}
            onMouseEnter={e => { if (!tab.active) e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (!tab.active) e.currentTarget.style.color = '#6B7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.7fr repeat(4, 1fr)', gap: 10,
        padding: 14, background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}>
            <SearchIcon />
          </span>
          <input
            className="filter-input-d"
            type="text"
            placeholder="Search by member, reference..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>
        <select
          className="filter-select-d"
          value={dateRange}
          onChange={e => { setDateRange(e.target.value as DateRange); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="this-month">This month</option>
          <option value="last-month">Last month</option>
          <option value="last-3-months">Last 3 months</option>
          <option value="this-year">This year</option>
          <option value="all-time">All time</option>
        </select>
        <select
          className="filter-select-d"
          value={combinedFilter}
          onChange={e => { setCombinedFilter(e.target.value as CombinedFilter); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="all">All Types</option>
          <option value="individual">Individual Only</option>
          <option value="collective">Collective Only</option>
          <optgroup label="Categories">
            <option value="tithe">Tithe</option>
            <option value="offering">Offering</option>
            <option value="sunday-offering">Sunday Offering</option>
            <option value="pledge">Pledge</option>
            <option value="building">Building Fund</option>
            <option value="thanksgiving">Thanksgiving</option>
            <option value="harvest">Harvest</option>
            <option value="other">Other</option>
          </optgroup>
        </select>
        <select
          className="filter-select-d"
          value={methodFilter}
          onChange={e => { setMethodFilter(e.target.value); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="all">All Methods</option>
          <option value="cash">Cash</option>
          <option value="momo">MoMo</option>
          <option value="bank">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
        <select
          className="filter-select-d"
          value={branchFilter}
          onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Table Card */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '24%' }}>Member</th>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Method</th>
              <th style={th}>Date</th>
              <th style={th}>Reference</th>
              <th style={{ ...th, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '60px 0', textAlign: 'center' }}>
                  {transactions.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, color: '#374151', fontWeight: 500 }}>
                        No transactions recorded yet.
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
                        Click Record Giving to add the first contribution.
                      </div>
                      <button
                        onClick={() => navigate('/donations/new')}
                        style={{
                          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
                          height: 36, padding: '0 16px', borderRadius: 8,
                          border: 'none', background: '#4F6BED', color: '#fff',
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        <PlusIcon /> Record Giving
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
                      No transactions match your filters.
                    </span>
                  )}
                </td>
              </tr>
            ) : paginated.map(t => {
              const isCollective = t.is_collective === true
              const firstName = t.member?.first_name ?? 'Anonymous'
              const lastName = t.member?.last_name ?? ''
              const memberNumber = t.member?.member_number ?? '—'
              const catName = t.transaction_categories?.name ?? ''
              return (
                <tr
                  key={t.id}
                  className="tx-row"
                  onClick={() => navigate(`/donations/${t.id}`)}
                  style={{
                    borderBottom: '0.5px solid #EFF1F7',
                    height: 56, background: '#fff',
                    transition: 'background 0.1s', cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {isCollective
                        ? <CollectiveAvatar />
                        : <Avatar firstName={firstName} lastName={lastName || 'A'} />
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isCollective ? 'Collective Offering' : t.member ? `${firstName} ${lastName}` : 'Anonymous'}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                          {isCollective ? '—' : memberNumber}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    {isCollective ? <CollectiveBadge /> : <CategoryPill categoryName={catName} />}
                  </td>
                  <td style={{ padding: '0 18px', textAlign: 'right' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#111827', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatAmount(t.amount)}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <MethodPill method={t.payment_method} />
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>
                      {formatDate(t.transaction_date)}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#4F6BED', fontWeight: 500 }}>
                      {t.reference_number ?? t.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, opacity: 1 }}>
                      <button
                        className="icon-mini"
                        aria-label="View"
                        onClick={e => { e.stopPropagation(); navigate(`/donations/${t.id}`) }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', display: 'grid', placeItems: 'center', color: '#6B7280', cursor: 'pointer' }}
                      >
                        <ArrowRightIcon />
                      </button>
                      <button
                        className="icon-mini"
                        aria-label="More"
                        onClick={e => e.stopPropagation()}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', display: 'grid', placeItems: 'center', color: '#6B7280', cursor: 'pointer' }}
                      >
                        <DotsIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', color: '#6B7280', fontSize: 12.5,
          borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE',
        }}>
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            {filtered.length === 0
              ? '0 transactions'
              : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} transactions`
            }
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronIcon dir="left" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              Next <ChevronIcon dir="right" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

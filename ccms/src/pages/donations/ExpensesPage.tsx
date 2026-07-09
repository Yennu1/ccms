import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSidebar } from '../../contexts/SidebarContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = 'this-month' | 'last-month' | 'custom'

interface ExpenseRow {
  id: string
  category_id: string | null
  amount: number
  payment_method: string
  expense_date: string
  notes: string | null
  branch_id: string
  created_at: string
  transaction_categories: { id: string; name: string } | null
}

interface Category { id: string; name: string }
interface Branch { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// Navy, Indigo, Periwinkle, Gold, Green, Teal — deterministically assigned per category id
const CATEGORY_PALETTE = [
  { dot: '#1B2352', bg: '#E9EAF3', color: '#1B2352' },
  { dot: '#4F6BED', bg: '#EEF1FE', color: '#3348C7' },
  { dot: '#7B93F5', bg: '#F0F1FE', color: '#5B63C7' },
  { dot: '#C8964A', bg: '#FEF6E5', color: '#8A6418' },
  { dot: '#22C55E', bg: '#DCFCE7', color: '#166534' },
  { dot: '#0F766E', bg: '#F0FDFA', color: '#0F766E' },
]

const METHOD_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  cash:          { bg: '#F3F4F6', color: '#6B7280', label: 'Cash' },
  momo:          { bg: '#FEF3C7', color: '#92400E', label: 'MoMo' },
  bank:          { bg: '#EEF2FF', color: '#4338CA', label: 'Bank Transfer' },
  bank_transfer: { bg: '#EEF2FF', color: '#4338CA', label: 'Bank Transfer' },
  cheque:        { bg: '#F3E8FF', color: '#6B21A8', label: 'Cheque' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryStyle(categoryId: string | null) {
  const str = categoryId ?? 'uncategorized'
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length]
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 3.5h9M5.5 3.5V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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

function ReceiptIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <path d="M7 4h14v20l-2.5-1.7L16 24l-2.5-1.7L11 24l-2.5-1.7L6 24V4Z" stroke="#4F6BED" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      <path d="M10.5 9h7M10.5 13h7M10.5 17h4" stroke="#4F6BED" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryPill({ categoryId, categoryName }: { categoryId: string | null; categoryName: string }) {
  const s = getCategoryStyle(categoryId)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {categoryName || 'Uncategorized'}
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

function KpiCard({ label, value, sub, delta, accent }: {
  label: string; value: string; sub?: string; delta?: number | null; accent: string
}) {
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '1px solid var(--dm-border-soft)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)', position: 'relative' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dm-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--dm-text-ink)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minHeight: 20 }}>
        {delta !== null && delta !== undefined && (
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 600, color: delta >= 0 ? '#EF4444' : '#22C55E', background: delta >= 0 ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)', padding: '1px 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {delta >= 0 ? <UpIcon /> : <DownIcon />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: 'var(--dm-text-muted)' }}>{sub}</span>}
      </div>
      <div style={{ position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: '50%', background: accent }} />
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '0.5px solid var(--dm-border-soft)', height: 56 }}>
      {[16, 10, 10, 10, 20, 5].map((w, i) => (
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

export function ExpensesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isMobile, isTablet } = useSidebar()

  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('this-month')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage] = useState(1)

  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    if (!user?.org_id) return
    const fetchData = async () => {
      setLoading(true)
      const [expResult, catResult, branchResult] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, transaction_categories(id, name)')
          .eq('org_id', user.org_id)
          .order('expense_date', { ascending: false }),
        supabase
          .from('transaction_categories')
          .select('id, name')
          .eq('org_id', user.org_id)
          .eq('type', 'expense')
          .order('name'),
        supabase
          .from('branches')
          .select('id, name')
          .eq('org_id', user.org_id),
      ])

      if (expResult.error) {
        toast.error('Failed to load expenses')
      } else {
        setExpenses((expResult.data ?? []) as unknown as ExpenseRow[])
      }
      if (!catResult.error) setCategories((catResult.data ?? []) as Category[])
      if (!branchResult.error) setBranches((branchResult.data ?? []) as Branch[])

      setLoading(false)
    }
    fetchData()
  }, [user?.org_id])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast.success('Expense deleted')
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  const thisMonthExpenses = useMemo(() =>
    expenses.filter(e => e.expense_date >= startOfMonth),
    [expenses, startOfMonth]
  )
  const lastMonthExpenses = useMemo(() =>
    expenses.filter(e => e.expense_date >= startOfLastMonth && e.expense_date <= endOfLastMonth),
    [expenses, startOfLastMonth, endOfLastMonth]
  )
  const thisYearExpenses = useMemo(() =>
    expenses.filter(e => e.expense_date >= startOfYear),
    [expenses, startOfYear]
  )

  const totalThisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0)
  const totalLastMonth = lastMonthExpenses.reduce((s, e) => s + e.amount, 0)
  const totalThisYear = thisYearExpenses.reduce((s, e) => s + e.amount, 0)
  const trendPct = totalLastMonth > 0
    ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
    : null

  const topCategory = useMemo(() => {
    const byCategory = new Map<string, { name: string; total: number }>()
    for (const e of thisMonthExpenses) {
      const key = e.category_id ?? 'uncategorized'
      const name = e.transaction_categories?.name ?? 'Uncategorized'
      const existing = byCategory.get(key)
      if (existing) {
        existing.total += e.amount
      } else {
        byCategory.set(key, { name, total: e.amount })
      }
    }
    let top: { name: string; total: number } | null = null
    for (const entry of byCategory.values()) {
      if (!top || entry.total > top.total) top = entry
    }
    return top
  }, [thisMonthExpenses])

  const topCategoryPct = topCategory && totalThisMonth > 0
    ? Math.round((topCategory.total / totalThisMonth) * 100)
    : 0

  const yearRangeLabel = `Jan 1 – ${now.toLocaleDateString('en-GH', { month: 'short', day: '2-digit' })}, ${now.getFullYear()}`

  // ─── Filtered + paginated ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let fromDate: string | null = null
    let toDate: string | null = null

    if (dateRange === 'this-month') {
      fromDate = startOfMonth
    } else if (dateRange === 'last-month') {
      fromDate = startOfLastMonth
      toDate = endOfLastMonth
    }

    return expenses.filter(e => {
      const q = search.toLowerCase()
      const notes = (e.notes ?? '').toLowerCase()
      const catName = (e.transaction_categories?.name ?? '').toLowerCase()
      const matchesSearch = !q || notes.includes(q) || catName.includes(q)

      const matchesDate =
        (!fromDate || e.expense_date >= fromDate) &&
        (!toDate || e.expense_date <= toDate)

      const matchesCategory = !categoryFilter || e.category_id === categoryFilter
      const matchesBranch = !branchFilter || e.branch_id === branchFilter

      return matchesSearch && matchesDate && matchesCategory && matchesBranch
    })
  }, [expenses, search, dateRange, categoryFilter, branchFilter, startOfMonth, startOfLastMonth, endOfLastMonth])

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
    if (!expenses || expenses.length === 0) {
      toast.error('No expenses to export')
      return
    }
    const XLSX = await import('xlsx')
    const rows = expenses.map(e => ({
      'Category': e.transaction_categories?.name ?? '—',
      'Amount (GHS)': e.amount,
      'Payment Method': e.payment_method,
      'Date': e.expense_date,
      'Notes': e.notes ?? '—',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, `ccms-expenses-${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Exported as Excel successfully')
  }

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast.error('No expenses to export')
      return
    }
    const headers = ['Category', 'Amount (GHS)', 'Payment Method', 'Date', 'Notes']
    const rows = expenses.map(e => [
      e.transaction_categories?.name ?? '—',
      e.amount.toFixed(2),
      e.payment_method,
      e.expense_date,
      e.notes ?? '—',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ccms-expenses-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Expenses exported successfully')
  }

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)',
    background: 'var(--dm-bg-card)', outline: 'none',
    transition: 'border-color 0.15s',
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

  const emptyState = expenses.length === 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#E8ECF9',
        display: 'grid', placeItems: 'center', marginBottom: 4,
      }}>
        <ReceiptIcon />
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, color: '#374151', fontWeight: 500 }}>
        No expenses recorded yet
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', textAlign: 'center', maxWidth: 280 }}>
        Track what your church spends — salaries, utilities, events, and more.
      </div>
      <button
        onClick={() => navigate('/donations/expenses/new')}
        style={{
          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 16px', borderRadius: 8,
          border: 'none', background: '#4F6BED', color: '#fff',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <PlusIcon /> Record Expense
      </button>
    </div>
  ) : (
    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
      No expenses match your filters.
    </span>
  )

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .exp-row:hover { background: var(--dm-bg-muted) !important; }
        .exp-row:hover .row-actions { opacity: 1 !important; }
        .filter-select-e:focus { border-color: #4F6BED !important; outline: none; }
        .filter-input-e:focus { border-color: #4F6BED !important; }
        .icon-mini:hover { background: var(--dm-bg-muted) !important; color: var(--dm-text-ink) !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: isMobile ? 12 : 20, marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 22, color: 'var(--dm-text-ink)',
            letterSpacing: '-0.015em', margin: '0 0 4px',
          }}>
            Expenses
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading
              ? 'Loading…'
              : `${formatAmount(totalThisMonth)} spent this month · ${thisMonthExpenses.length} expenses`
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
                border: '0.5px solid var(--dm-border)', background: exportOpen ? 'var(--dm-bg-muted)' : 'var(--dm-bg-card)', color: 'var(--dm-text-body)',
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
                background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
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
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
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
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Export as Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/donations/expenses/new')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 16px', borderRadius: 8,
              border: 'none', background: '#4F6BED', color: '#fff',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon /> Record Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="Total This Month"
          value={loading ? '—' : formatAmount(totalThisMonth)}
          delta={trendPct}
          sub="vs last month"
          accent="#4F6BED"
        />
        <KpiCard
          label="Total This Year"
          value={loading ? '—' : formatAmount(totalThisYear)}
          sub={yearRangeLabel}
          accent="#7B93F5"
        />
        <KpiCard
          label="Top Category"
          value={loading ? '—' : topCategory ? topCategory.name : 'No expenses yet'}
          sub={loading || !topCategory ? undefined : `${formatAmount(topCategory.total)} · ${topCategoryPct}% of total spend`}
          accent="#C8964A"
        />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 20 }}>
        {[
          { label: 'Transactions', active: false, onClick: () => navigate('/donations') },
          { label: 'Pledges', active: false, onClick: () => navigate('/donations/pledges') },
          { label: 'Expenses', active: true, onClick: () => {} },
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

      {/* Filter Bar */}
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        flexWrap: isMobile ? 'wrap' : undefined,
        gridTemplateColumns: isMobile ? undefined : isSuperAdmin ? '1.7fr repeat(3, 1fr)' : '1.7fr repeat(2, 1fr)', gap: 10,
        padding: 14, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? '100%' : undefined }}>
          <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}>
            <SearchIcon />
          </span>
          <input
            className="filter-input-e"
            type="text"
            placeholder="Search by notes or category..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>
        <select
          className="filter-select-e"
          value={dateRange}
          onChange={e => { setDateRange(e.target.value as DateRange); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', width: isMobile ? '100%' : undefined }}
        >
          <option value="this-month">This Month</option>
          <option value="last-month">Last Month</option>
          <option value="custom">Custom</option>
        </select>
        <select
          className="filter-select-e"
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', width: isMobile ? '100%' : undefined }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {isSuperAdmin && (
          <select
            className="filter-select-e"
            value={branchFilter}
            onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
            style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer', width: isMobile ? '100%' : undefined }}
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table Card */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, display: isMobile ? 'none' : undefined }}>
          <thead>
            <tr>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Method</th>
              <th style={th}>Date</th>
              <th style={{ ...th, width: '26%' }}>Notes</th>
              <th style={{ ...th, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '60px 0', textAlign: 'center' }}>
                  {emptyState}
                </td>
              </tr>
            ) : paginated.map(e => (
              <tr
                key={e.id}
                className="exp-row"
                style={{
                  borderBottom: '0.5px solid var(--dm-border-soft)',
                  height: 56, background: 'var(--dm-bg-card)',
                  transition: 'background 0.1s',
                }}
              >
                <td style={{ padding: '0 18px' }}>
                  <CategoryPill categoryId={e.category_id} categoryName={e.transaction_categories?.name ?? ''} />
                </td>
                <td style={{ padding: '0 18px', textAlign: 'right' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: 'var(--dm-text-ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(e.amount)}
                  </span>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <MethodPill method={e.payment_method} />
                </td>
                <td style={{ padding: '0 18px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>
                    {formatDate(e.expense_date)}
                  </span>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: 'var(--dm-text-body)',
                    display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240,
                  }}>
                    {e.notes || '—'}
                  </span>
                </td>
                <td style={{ padding: '0 12px' }}>
                  <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, opacity: 1 }}>
                    <button
                      className="icon-mini"
                      aria-label="Edit expense"
                      onClick={() => navigate(`/donations/expenses/${e.id}/edit`)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="icon-mini"
                      aria-label="Delete expense"
                      onClick={() => handleDelete(e.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: '#EF4444', cursor: 'pointer' }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile card list — replaces the table on phones */}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <>{[1, 2, 3].map(i => (
                <div key={i} style={{ height: 84, borderRadius: 10, background: 'var(--dm-bg-muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}</>
            ) : paginated.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                {emptyState}
              </div>
            ) : (
              paginated.map(e => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/donations/expenses/${e.id}/edit`)}
                  style={{
                    background: 'var(--dm-bg-card)',
                    border: '0.5px solid var(--dm-border-soft)',
                    borderRadius: 10,
                    padding: 14,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <CategoryPill categoryId={e.category_id} categoryName={e.transaction_categories?.name ?? ''} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, color: 'var(--dm-text-ink)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {formatAmount(e.amount)}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
                      {formatDate(e.expense_date)}
                    </span>
                    <MethodPill method={e.payment_method} />
                  </div>
                  {e.notes && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--dm-border-soft)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: 'var(--dm-text-body)' }}>
                      {e.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', color: '#6B7280', fontSize: 12.5,
          borderTop: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-surface)',
        }}>
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            {filtered.length === 0
              ? '0 expenses'
              : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} expenses`
            }
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronIcon dir="left" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              Next <ChevronIcon dir="right" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

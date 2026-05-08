import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'tithe' | 'offering' | 'building' | 'welfare' | 'thanksgiving' | 'special'
type Method = 'cash' | 'momo' | 'bank' | 'cheque'

interface Transaction {
  id: string
  firstName: string
  lastName: string
  memberNumber: string
  category: Category
  amount: number
  method: Method
  date: string
}

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

const METHOD_STYLES: Record<Method, { bg: string; color: string; label: string }> = {
  cash:   { bg: '#F3F4F6', color: '#6B7280', label: 'Cash' },
  momo:   { bg: '#FEF3C7', color: '#92400E', label: 'MoMo' },
  bank:   { bg: '#EEF2FF', color: '#4338CA', label: 'Bank Transfer' },
  cheque: { bg: '#F3E8FF', color: '#6B21A8', label: 'Cheque' },
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

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 'REF-001', firstName: 'Kwame',    lastName: 'Asante',   memberNumber: 'GH-00001', category: 'tithe',        amount: 500,  method: 'cash', date: 'May 04, 2026' },
  { id: 'REF-002', firstName: 'Abena',    lastName: 'Mensah',   memberNumber: 'GH-00002', category: 'offering',     amount: 200,  method: 'momo', date: 'May 04, 2026' },
  { id: 'REF-003', firstName: 'Kofi',     lastName: 'Boateng',  memberNumber: 'GH-00003', category: 'building',     amount: 1000, method: 'bank', date: 'May 03, 2026' },
  { id: 'REF-004', firstName: 'Ama',      lastName: 'Owusu',    memberNumber: 'GH-00004', category: 'tithe',        amount: 300,  method: 'cash', date: 'May 03, 2026' },
  { id: 'REF-005', firstName: 'Emmanuel', lastName: 'Darko',    memberNumber: 'GH-00005', category: 'welfare',      amount: 150,  method: 'momo', date: 'May 02, 2026' },
  { id: 'REF-006', firstName: 'Akosua',   lastName: 'Frimpong', memberNumber: 'GH-00006', category: 'thanksgiving', amount: 250,  method: 'cash', date: 'May 02, 2026' },
  { id: 'REF-007', firstName: 'Yaw',      lastName: 'Adjei',    memberNumber: 'GH-00007', category: 'tithe',        amount: 400,  method: 'momo', date: 'May 01, 2026' },
  { id: 'REF-008', firstName: 'Adwoa',    lastName: 'Amponsah', memberNumber: 'GH-00008', category: 'offering',     amount: 100,  method: 'cash', date: 'May 01, 2026' },
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

function CategoryPill({ category }: { category: Category }) {
  const s = CATEGORY_STYLES[category]
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

function MethodPill({ method }: { method: Method }) {
  const s = METHOD_STYLES[method]
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function DonationsPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | Method>('all')
  const [page, setPage] = useState(1)

  const filtered = SAMPLE_TRANSACTIONS.filter(t => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
      t.memberNumber.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter
    const matchesMethod = methodFilter === 'all' || t.method === methodFilter
    return matchesSearch && matchesCategory && matchesMethod
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280',
          }}>
            ₵48,920 collected this month · 284 transactions
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => toast.info('Export feature coming soon')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff', color: '#374151',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFE')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <ExportIcon /> Export
          </button>
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
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₵48,920</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> +8.2% vs last month
          </div>
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <path d="M0,28 L20,24 L40,26 L60,20 L80,22 L100,16 L120,18 L140,12 L160,14 L180,8 L200,6" fill="none" stroke="#4F6BED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,28 L20,24 L40,26 L60,20 L80,22 L100,16 L120,18 L140,12 L160,14 L180,8 L200,6 L200,36 L0,36 Z" fill="#4F6BED" opacity="0.08" />
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>Last month · ₵45,210</div>
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
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₵32,400</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> +5.1% vs last month
          </div>
          <svg style={{ marginTop: 12, height: 36, width: '100%', display: 'block' }} viewBox="0 0 200 36" preserveAspectRatio="none">
            <path d="M0,26 L20,24 L40,22 L60,18 L80,20 L100,14 L120,16 L140,10 L160,12 L180,8 L200,6" fill="none" stroke="#C8964A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,26 L20,24 L40,22 L60,18 L80,20 L100,14 L120,16 L140,10 L160,12 L180,8 L200,6 L200,36 L0,36 Z" fill="#C8964A" opacity="0.10" />
          </svg>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>66% of total contributions</div>
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
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₵11,200</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <DownIcon /> −2.3% vs last month
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
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#111827', marginTop: 8, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>₵5,320</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,.10)', padding: '2px 8px', borderRadius: 999, marginTop: 8 }}>
            <UpIcon /> +12.4% vs last month
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
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', padding: '8px 0 16px' }}>Goal ₵250,000 · 38% reached</div>
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
        <select className="filter-select-d" style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option>This month</option>
          <option>Last month</option>
          <option>Last 3 months</option>
          <option>This year</option>
          <option>All time</option>
        </select>
        <select
          className="filter-select-d"
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value as typeof categoryFilter); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="all">All Categories</option>
          <option value="tithe">Tithe</option>
          <option value="offering">Offering</option>
          <option value="building">Building Fund</option>
          <option value="welfare">Welfare</option>
          <option value="thanksgiving">Thanksgiving</option>
          <option value="special">Special Offering</option>
        </select>
        <select
          className="filter-select-d"
          value={methodFilter}
          onChange={e => { setMethodFilter(e.target.value as typeof methodFilter); setPage(1) }}
          style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}
        >
          <option value="all">All Methods</option>
          <option value="cash">Cash</option>
          <option value="momo">MoMo</option>
          <option value="bank">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
        <select className="filter-select-d" style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option>All Branches</option>
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '60px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
                  No transactions match your filters.
                </td>
              </tr>
            ) : paginated.map(t => (
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
                    <Avatar firstName={t.firstName} lastName={t.lastName} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.firstName} {t.lastName}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                        {t.memberNumber}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <CategoryPill category={t.category} />
                </td>
                <td style={{ padding: '0 18px', textAlign: 'right' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#111827', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(t.amount)}
                  </span>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <MethodPill method={t.method} />
                </td>
                <td style={{ padding: '0 18px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{t.date}</span>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#4F6BED', fontWeight: 500 }}>{t.id}</span>
                </td>
                <td style={{ padding: '0 12px' }}>
                  <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, opacity: 0, transition: 'opacity 0.1s' }}>
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
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', color: '#6B7280', fontSize: 12.5,
          borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE',
        }}>
          <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} transactions</span>
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

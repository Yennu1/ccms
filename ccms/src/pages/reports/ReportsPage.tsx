import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSidebar } from '../../contexts/SidebarContext'
import { ExportModal } from '../../components/ExportModal'
import { generateIncomeExpenditurePdf } from '../../lib/exportIncomeExpenditurePdf'
import { generateIncomeExpenditureExcel } from '../../lib/exportIncomeExpenditureExcel'
import type {
  IncomeExpenditureReportData,
  ReportLineItem,
} from '../../lib/exportIncomeExpenditurePdf'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = 'giving' | 'expense' | 'attendance' | 'members' | 'groups'
type ReportGroup = 'income' | 'expense' | 'others'
type GivingPeriod = '3M' | '6M' | '12M'

// which top-level group each sub-tab lives under
const TAB_GROUP: Record<ReportTab, ReportGroup> = {
  giving: 'income', expense: 'expense',
  attendance: 'others', members: 'others', groups: 'others',
}
const GROUP_TABS: Record<ReportGroup, ReportTab[]> = {
  income: ['giving'], expense: ['expense'], others: ['attendance', 'members', 'groups'],
}
const GROUP_LABEL: Record<ReportGroup, string> = { income: 'Income', expense: 'Expense', others: 'Others' }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// One continuous ramp: deep indigo -> light indigo, then dark grey -> light grey.
// Categories are ordered biggest-first, so index 0 (biggest) is the deepest.
function expenseRamp(i: number, n: number): string {
  if (n <= 1) return '#4F6BED'
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const hex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
  const t = i / (n - 1)
  const split = 0.6
  if (t <= split) {
    const u = t / split // deep indigo #26215C -> light indigo #AFA9EC
    return hex(lerp(38, 175, u), lerp(33, 169, u), lerp(92, 236, u))
  }
  const u = (t - split) / (1 - split) // dark grey #3F3F46 -> light grey #E5E7EB
  return hex(lerp(63, 229, u), lerp(63, 231, u), lerp(70, 235, u))
}
type AttWeeks = 4 | 8 | 12 | 24

interface Branch { id: string; name: string }

interface ExpenseRow {
  amount: number
  expense_date: string
  transaction_categories: { name: string } | null
}
interface TopGiver {
  member_id: string; first_name: string; last_name: string
  member_number: string; branch_name: string
  total_given: number; gift_count: number; last_gift_date: string
}
interface GivingByBranch { branch_id: string; branch_name: string; total: number }

interface WeeklyAtt {
  week_start: string; present_count: number; expected_count: number; rate: number
}
interface AttByEventType {
  event_type: string; avg_rate: number; event_count: number; total_present: number
}
interface AtRisk {
  id: string; first_name: string; last_name: string; member_number: string
  branch_name: string; group_name: string; last_seen: string; days_since: number
}

interface MemberGrowth { month: string; new_members: number; cumulative: number }
interface GenderBreakdown { gender: string; cnt: number }
interface AgeBreakdown { age_group: string; cnt: number }
interface NewMember {
  id: string; first_name: string; last_name: string; member_number: string
  branch_name: string | null; created_at: string; in_group: boolean
}
interface BirthdayMember {
  id: string; first_name: string; last_name: string; member_number: string
  branch_name: string | null; date_of_birth: string
}

interface GroupRow {
  id: string; name: string; is_active: boolean
  ministry_name: string | null; branch_name: string | null
  member_count: number; leader_name: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_COLORS = ['#4F6BED', '#EC4899']
const AP = [
  { bg: 'var(--avatar-1-bg)', color: 'var(--avatar-1-fg)' },
  { bg: 'var(--avatar-2-bg)', color: 'var(--avatar-2-fg)' },
  { bg: 'var(--avatar-3-bg)', color: 'var(--avatar-3-fg)' },
  { bg: 'var(--avatar-4-bg)', color: 'var(--avatar-4-fg)' },
  { bg: 'var(--avatar-5-bg)', color: 'var(--avatar-5-fg)' },
  { bg: 'var(--avatar-6-bg)', color: 'var(--avatar-6-fg)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fGHS(n: number) {
  return `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fGHSFull(n: number) {
  return `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function monthLabel(m: string) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' })
}
// "2026-01" → "JANUARY" / "JANUARY 2026" — the Income & Expenditure sheet uses
// full upper-case month names, not the short labels the charts use.
function monthFullLabel(m: string) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en', { month: 'long' }).toUpperCase()
}
function monthYearLabel(m: string) {
  if (!m) return ''
  return `${monthFullLabel(m)} ${m.split('-')[0]}`
}
function fEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function avatarPalette(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AP[Math.abs(h) % AP.length]
}
function periodStart(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months + 1)
  d.setDate(1)
  return d.toISOString().split('T')[0]
}
function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
function fDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fShortDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ h = 160, r = 8 }: { h?: number; r?: number }) {
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={{ height: h, borderRadius: r, background: 'var(--dm-bg-muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '1px solid var(--dm-border-soft)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)', position: 'relative' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dm-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--dm-text-ink)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: 'var(--dm-text-muted)', marginTop: 4 }}>{sub}</div>}
      <div style={{ position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: '50%', background: accent }} />
    </div>
  )
}

function Avatar({ firstName, lastName, size = 32 }: { firstName: string; lastName: string; size?: number }) {
  const { bg, color } = avatarPalette(firstName + lastName)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: size * 0.34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {firstName[0]?.toUpperCase()}{lastName[0]?.toUpperCase()}
    </div>
  )
}

function SectionHeader({ title, onExport }: { title: string; onExport?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>{title}</div>
      {onExport && (
        <button
          onClick={onExport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--dm-text-body)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--dm-bg-surface)'; e.currentTarget.style.borderColor = 'var(--dm-border-strong)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--dm-bg-card)'; e.currentTarget.style.borderColor = 'var(--dm-border-soft)' }}
        >
          <DownloadIcon /> Export
        </button>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--dm-text-muted)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13 }}>
      {message}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3v8M5 8l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function AlertIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 2L14 13H2L8 2Z" stroke="#F59E0B" strokeWidth="1.4" strokeLinejoin="round" fill="none" /><path d="M8 6.5V9M8 11v.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

// ─── Tooltip components ───────────────────────────────────────────────────────

function ExpenseTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; fill: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => (p.value ?? 0) > 0)
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 280, overflowY: 'auto' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-secondary)', marginBottom: 6 }}>{monthLabel(label ?? '')}</div>
      {rows.length === 0 ? (
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: 'var(--dm-text-muted)' }}>No expenses</div>
      ) : rows.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: 'var(--dm-text-body)', marginBottom: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--dm-text-secondary)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.fill, border: '0.5px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
            {p.name}
          </span>
          <span>{fGHSFull(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '0.5px solid var(--dm-border-subtle)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--dm-text-ink)' }}>
        <span>Total</span><span>{fGHSFull(total)}</span>
      </div>
    </div>
  )
}

function AttTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-secondary)', marginBottom: 3 }}>Wk of {fShortDate(label)}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: 'var(--dm-text-ink)', fontWeight: 600 }}>{Number(payload[0]?.value ?? 0).toFixed(1)}%</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth()
  const { isMobile, isTablet } = useSidebar()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // finance_officer only sees Giving; guard also covers URL manipulation (?tab=members)
  const role = user?.role
  const visibleReportTabs: ReportTab[] = role === 'finance_officer'
    ? ['giving', 'expense']
    : ['giving', 'expense', 'attendance', 'members', 'groups']

  const rawTab = (searchParams.get('tab') ?? 'giving') as ReportTab
  const activeTab = visibleReportTabs.includes(rawTab) ? rawTab : 'giving'
  function setTab(t: ReportTab) { setSearchParams({ tab: t }) }

  // Top-level group (Income / Expense / Others) derived from the active sub-tab.
  const activeGroup = TAB_GROUP[activeTab]
  const visibleGroups: ReportGroup[] = (['income', 'expense', 'others'] as ReportGroup[])
    .filter(g => GROUP_TABS[g].some(t => visibleReportTabs.includes(t)))
  function setGroup(g: ReportGroup) {
    const first = GROUP_TABS[g].find(t => visibleReportTabs.includes(t))
    if (first) setTab(first)
  }

  // Shared
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const branchId = selectedBranch || null
  // Church name printed at the top of the Income & Expenditure account
  const [orgName, setOrgName] = useState('')

  // Giving tab
  const [givingPeriod] = useState<GivingPeriod>('12M')
  const [topGivers, setTopGivers] = useState<TopGiver[]>([])
  const [givingByBranch, setGivingByBranch] = useState<GivingByBranch[]>([])
  // Expense rows for the selected period — feeds the Income & Expenditure PDF

  // Expense report tab
  const nowDate = new Date()
  const [expYear, setExpYear] = useState<number>(nowDate.getFullYear())
  const [expMonths, setExpMonths] = useState<number[]>([nowDate.getMonth() + 1]) // default: current month
  const [expMenuOpen, setExpMenuOpen] = useState(false)
  const [expRows, setExpRows] = useState<ExpenseRow[]>([])
  const [loadingExpense, setLoadingExpense] = useState(false)
  const [exportExpense, setExportExpense] = useState<'trend' | 'cats' | null>(null)
  const expYearOptions = Array.from({ length: 6 }, (_, i) => nowDate.getFullYear() + i) // this year + next 5
  const sortedExpMonths = [...expMonths].sort((a, b) => a - b)

  // Income (giving) chart filter — mirrors the expense chart's month/year picker
  const [incYear, setIncYear] = useState<number>(nowDate.getFullYear())
  const [incMonths, setIncMonths] = useState<number[]>([nowDate.getMonth() + 1])
  const [incMenuOpen, setIncMenuOpen] = useState(false)
  const [incRows, setIncRows] = useState<ExpenseRow[]>([])
  const sortedIncMonths = [...incMonths].sort((a, b) => a - b)
  function toggleIncMonth(m: number) {
    setIncMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }
  // I&E account export filter — independent of the chart, drives only the PDF
  const [ieYear, setIeYear] = useState<number>(nowDate.getFullYear())
  const [ieMonths, setIeMonths] = useState<number[]>([nowDate.getMonth() + 1])
  const [ieMenuOpen, setIeMenuOpen] = useState(false)
  const [ieExportMenuOpen, setIeExportMenuOpen] = useState(false)
  const [ieRows, setIeRows] = useState<{ income: ExpenseRow[]; expense: ExpenseRow[] }>({ income: [], expense: [] })
  const sortedIeMonths = [...ieMonths].sort((a, b) => a - b)
  function toggleIeMonth(m: number) {
    setIeMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }
  function toggleExpMonth(m: number) {
    setExpMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }
  const [loadingGiving, setLoadingGiving] = useState(false)
  const [exportGiving, setExportGiving] = useState<'trend' | 'givers' | null>(null)

  // Attendance tab
  const [attWeeks, setAttWeeks] = useState<AttWeeks>(12)
  const [weeklyAtt, setWeeklyAtt] = useState<WeeklyAtt[]>([])
  const [attByType, setAttByType] = useState<AttByEventType[]>([])
  const [atRisk, setAtRisk] = useState<AtRisk[]>([])
  const [loadingAtt, setLoadingAtt] = useState(false)
  const [exportAtRisk, setExportAtRisk] = useState(false)

  // Members tab
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowth[]>([])
  const [genderBreakdown, setGenderBreakdown] = useState<GenderBreakdown[]>([])
  const [ageBreakdown, setAgeBreakdown] = useState<AgeBreakdown[]>([])
  const [newMembers, setNewMembers] = useState<NewMember[]>([])
  const [birthdays, setBirthdays] = useState<BirthdayMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [exportNewMembers, setExportNewMembers] = useState(false)
  const [exportBirthdays, setExportBirthdays] = useState(false)

  // Groups tab
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [exportGroups, setExportGroups] = useState(false)

  // ── Branches ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
    supabase.from('organisations').select('name').eq('id', user.org_id).single()
      .then(({ data }) => { if (data) setOrgName(data.name) })
  if (user.role !== 'super_admin' && user.branch_id) setSelectedBranch(user.branch_id)
  }, [user?.org_id])

  // ── Giving data ─────────────────────────────────────────────────────────────

  const fetchGiving = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'giving') return
    const orgId = user.org_id
    const bId = branchId
    const months = givingPeriod === '3M' ? 3 : givingPeriod === '6M' ? 6 : 12
    const start = periodStart(months)
    const end = todayStr()
    setLoadingGiving(true)
    try {
      const [byBranch, top] = await Promise.all([
        !bId ? supabase.rpc('get_giving_by_branch', { p_org_id: orgId, p_start: start, p_end: end }) : Promise.resolve({ data: [] }),
        supabase.rpc('get_top_givers', { p_org_id: orgId, p_branch_id: bId, p_start: start, p_end: end, p_limit: 10 }),
      ])
      setGivingByBranch((byBranch.data ?? []) as GivingByBranch[])
      setTopGivers((top.data ?? []) as TopGiver[])
    } finally {
      setLoadingGiving(false)
    }
  }, [user?.org_id, selectedBranch, activeTab, givingPeriod])

  // ── Income chart data (real categories, like the expense chart) ─────────────
  const fetchIncome = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'giving') return
    if (sortedIncMonths.length === 0) { setIncRows([]); return }
    const start = `${incYear}-01-01`
    const end = `${incYear}-12-31`
    let q = supabase.from('transactions')
      .select('amount, transaction_date, transaction_categories(name, type)')
      .eq('org_id', user.org_id)
      .gte('transaction_date', start)
      .lte('transaction_date', end)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    const rows = ((data ?? []) as unknown as Array<{ amount: number; transaction_date: string; transaction_categories: { name: string; type: string } | null }>)
      .filter(r => r.transaction_categories?.type === 'income')
      .map(r => ({ amount: r.amount, expense_date: r.transaction_date, transaction_categories: r.transaction_categories ? { name: r.transaction_categories.name } : null }))
    setIncRows(rows as unknown as ExpenseRow[])
  }, [user?.org_id, branchId, activeTab, incYear, sortedIncMonths.join(',')])
  useEffect(() => { fetchIncome() }, [fetchIncome])

  // ── I&E export data (own month/year filter) ─────────────────────────────────
  const fetchIeRows = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'giving') return
    if (sortedIeMonths.length === 0) { setIeRows({ income: [], expense: [] }); return }
    const start = `${ieYear}-01-01`
    const end = `${ieYear}-12-31`
    let incQ = supabase.from('transactions')
      .select('amount, transaction_date, transaction_categories(name, type)')
      .eq('org_id', user.org_id).gte('transaction_date', start).lte('transaction_date', end)
    let expQ = supabase.from('expenses')
      .select('amount, expense_date, transaction_categories(name)')
      .eq('org_id', user.org_id).gte('expense_date', start).lte('expense_date', end)
    if (branchId) { incQ = incQ.eq('branch_id', branchId); expQ = expQ.eq('branch_id', branchId) }
    const [inc, exp] = await Promise.all([incQ, expQ])
    const incRows2 = ((inc.data ?? []) as unknown as Array<{ amount: number; transaction_date: string; transaction_categories: { name: string; type: string } | null }>)
      .filter(r => r.transaction_categories?.type === 'income')
      .map(r => ({ amount: r.amount, expense_date: r.transaction_date, transaction_categories: r.transaction_categories ? { name: r.transaction_categories.name } : null }))
    setIeRows({ income: incRows2 as unknown as ExpenseRow[], expense: (exp.data ?? []) as unknown as ExpenseRow[] })
  }, [user?.org_id, branchId, activeTab, ieYear, sortedIeMonths.join(',')])
  useEffect(() => { fetchIeRows() }, [fetchIeRows])

  useEffect(() => { fetchGiving() }, [fetchGiving])

  // ── Expense report data ──────────────────────────────────────────────────────
  const fetchExpense = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'expense') return
    if (sortedExpMonths.length === 0) { setExpRows([]); return }
    setLoadingExpense(true)
    try {
      const start = `${expYear}-01-01`
      const end = `${expYear}-12-31`
      let q = supabase.from('expenses')
        .select('amount, expense_date, transaction_categories(name)')
        .eq('org_id', user.org_id)
        .gte('expense_date', start)
        .lte('expense_date', end)
      if (branchId) q = q.eq('branch_id', branchId)
      const { data } = await q
      setExpRows((data ?? []) as unknown as ExpenseRow[])
    } finally {
      setLoadingExpense(false)
    }
  }, [user?.org_id, branchId, activeTab, expYear, sortedExpMonths.join(',')])

  useEffect(() => { fetchExpense() }, [fetchExpense])

  // ── Attendance data ──────────────────────────────────────────────────────────

  const fetchAttendance = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'attendance') return
    const orgId = user.org_id
    const bId = branchId
    const weeksAgo = attWeeks
    const start = new Date(Date.now() - weeksAgo * 7 * 86400000).toISOString().split('T')[0]
    const end = todayStr()
    setLoadingAtt(true)
    try {
      const [weekly, byType, risk] = await Promise.all([
        supabase.rpc('get_weekly_attendance', { p_org_id: orgId, p_branch_id: bId, p_weeks: weeksAgo }),
        supabase.rpc('get_attendance_by_event_type', { p_org_id: orgId, p_branch_id: bId, p_start: start, p_end: end }),
        supabase.rpc('get_members_at_risk', { p_org_id: orgId, p_branch_id: bId, p_days: 42, p_limit: 30 }),
      ])
      setWeeklyAtt((weekly.data ?? []) as WeeklyAtt[])
      setAttByType((byType.data ?? []) as AttByEventType[])
      const riskData = (risk.data ?? []) as AtRisk[]
      setAtRisk(Array.from(new Map(riskData.map(m => [m.id, m])).values()))
    } finally {
      setLoadingAtt(false)
    }
  }, [user?.org_id, selectedBranch, activeTab, attWeeks])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  // ── Members data ─────────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'members') return
    const orgId = user.org_id
    const bId = branchId
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
    setLoadingMembers(true)
    try {
      const growthQ = supabase.rpc('get_monthly_member_growth', { p_org_id: orgId, p_branch_id: bId, p_months: 12 })
      const genderQ = supabase.rpc('get_gender_breakdown', { p_org_id: orgId, p_branch_id: bId })
      const ageQ = supabase.rpc('get_age_breakdown', { p_org_id: orgId, p_branch_id: bId })
      let newQ = supabase.from('members').select('id, first_name, last_name, member_number, created_at, branches(id, name), group_memberships(id)').eq('org_id', orgId).gte('created_at', ninetyDaysAgo).order('created_at', { ascending: false }).limit(50)
      if (bId) newQ = newQ.eq('branch_id', bId) as typeof newQ
      let bdQ = supabase.from('members').select('id, first_name, last_name, member_number, date_of_birth, branches(id, name)').eq('org_id', orgId).eq('membership_status', 'active').not('date_of_birth', 'is', null)
      if (bId) bdQ = bdQ.eq('branch_id', bId) as typeof bdQ
      const [growth, gender, age, newM, bd] = await Promise.all([growthQ, genderQ, ageQ, newQ, bdQ])
      setMemberGrowth((growth.data ?? []) as MemberGrowth[])
      setGenderBreakdown((gender.data ?? []) as GenderBreakdown[])
      setAgeBreakdown((age.data ?? []) as AgeBreakdown[])
      const nm = ((newM.data ?? []) as unknown as Array<{
        id: string; first_name: string; last_name: string; member_number: string; created_at: string
        branches: { id: string; name: string } | null
        group_memberships: { id: string }[]
      }>).map(m => ({
        id: m.id, first_name: m.first_name, last_name: m.last_name,
        member_number: m.member_number, created_at: m.created_at,
        branch_name: m.branches?.name ?? null,
        in_group: (m.group_memberships?.length ?? 0) > 0,
      }))
      setNewMembers(nm)
      const currentMonth = new Date().getMonth()
      const bdData = ((bd.data ?? []) as unknown as Array<{
        id: string; first_name: string; last_name: string; member_number: string
        date_of_birth: string; branches: { id: string; name: string } | null
      }>)
        .filter(m => new Date(m.date_of_birth).getMonth() === currentMonth)
        .sort((a, b) => new Date(a.date_of_birth).getDate() - new Date(b.date_of_birth).getDate())
      setBirthdays(bdData.map(m => ({
        id: m.id, first_name: m.first_name, last_name: m.last_name,
        member_number: m.member_number, date_of_birth: m.date_of_birth,
        branch_name: m.branches?.name ?? null,
      })))
    } finally {
      setLoadingMembers(false)
    }
  }, [user?.org_id, selectedBranch, activeTab])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // ── Groups data ──────────────────────────────────────────────────────────────

  const fetchGroups = useCallback(async () => {
    if (!user?.org_id || activeTab !== 'groups') return
    const orgId = user.org_id
    const bId = branchId
    setLoadingGroups(true)
    try {
      let q = supabase.from('groups').select(`
        id, name, is_active, ministry_id, branch_id,
        ministries(name),
        branches(id, name),
        group_memberships(id),
        leader:members!groups_leader_id_fkey(first_name, last_name)
      `).eq('org_id', orgId).order('name')
      if (bId) q = q.eq('branch_id', bId) as typeof q
      const { data } = await q
      const rows: GroupRow[] = ((data ?? []) as unknown as Array<{
        id: string; name: string; is_active: boolean
        ministries: { name: string } | null
        branches: { name: string } | null
        group_memberships: { id: string }[]
        leader: { first_name: string; last_name: string } | null
      }>).map(g => ({
        id: g.id, name: g.name, is_active: g.is_active,
        ministry_name: g.ministries?.name ?? null,
        branch_name: g.branches?.name ?? null,
        member_count: g.group_memberships?.length ?? 0,
        leader_name: g.leader ? `${g.leader.first_name} ${g.leader.last_name}` : null,
      }))
      setGroups(rows)
    } finally {
      setLoadingGroups(false)
    }
  }, [user?.org_id, selectedBranch, activeTab])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  // ── Derived stats ────────────────────────────────────────────────────────────


  // Narrative insights for the Giving by Category PDF export. Built from the
  // already-loaded givingByCat rows — no extra fetch.

  // ── Income & Expenditure account (PDF) ──────────────────────────────────────
  //
  // Renders the church's real accounting layout via
  // src/lib/exportIncomeExpenditurePdf.ts. Additive — the generic ExportModal
  // above is untouched.
  //
  // INCOME is mapped from the real `givingByCat` rows already loaded for the
  // selected 3M / 6M / 12M range, so it needs no extra fetch.
  //
  // EXPENDITURE is bucketed from the I&E-filtered expense rows, by
  // category × month. `transaction_categories` has no parent/grouping column,
  // so expense categories are a flat list — rendered with groupName: null (no
  // sub-headers, no sub-totals). If category groups are added later, split the
  // rows into one ExpenditureGroup per group and the PDF picks up sub-headers
  // and per-group TOTAL rows automatically.
  //
  // TODO(broughtForward): `broughtForward` stays null — there is no opening
  // balance in the schema, and the real B/F predates the system. Pass the
  // figure here once the church records it.

  function buildIncomeExpenditureData(): IncomeExpenditureReportData | null {
    const monthsWanted = sortedIeMonths.map(m => `${ieYear}-${String(m).padStart(2, '0')}`)
    if (monthsWanted.length === 0) return null
    if (ieRows.income.length === 0 && ieRows.expense.length === 0) return null

    const monthLabels = monthsWanted.map(monthFullLabel)
    const monthIndex = new Map(monthsWanted.map((m, i) => [m, i]))

    // Bucket rows into [CATEGORY][month]; blank (null) cell when nothing that month.
    const bucket = (rows: ExpenseRow[]) => {
      const byCat = new Map<string, (number | null)[]>()
      rows.forEach(e => {
        const idx = monthIndex.get(String(e.expense_date).slice(0, 7))
        if (idx === undefined) return
        const name = (e.transaction_categories?.name ?? 'Uncategorised').toUpperCase()
        if (!byCat.has(name)) byCat.set(name, monthsWanted.map(() => null))
        const cells = byCat.get(name)!
        cells[idx] = Math.round(((cells[idx] ?? 0) + Number(e.amount)) * 100) / 100
      })
      return [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([particulars, monthlyActuals]) => ({
          particulars, monthlyActuals,
          total: monthlyActuals.reduce<number | null>((sm, v) => (v === null ? sm : (sm ?? 0) + v), null),
        }))
    }

    const sumRows = (rows: ReportLineItem[], label: string): ReportLineItem => {
      const monthlyActuals = monthLabels.map((_, i) =>
        rows.reduce<number | null>((sm, row) => {
          const v = row.monthlyActuals[i]
          return v === null || v === undefined ? sm : (sm ?? 0) + v
        }, null),
      )
      const total = monthlyActuals.reduce<number | null>((sm, v) => (v === null ? sm : (sm ?? 0) + v), null)
      return { particulars: label, monthlyActuals, total }
    }

    const incomeCategories = bucket(ieRows.income)
    const expenditureCategories = bucket(ieRows.expense)

    const first = monthYearLabel(monthsWanted[0])
    const last = monthYearLabel(monthsWanted[monthsWanted.length - 1])
    const period = first === last ? first : `${first} TO ${last}`
    const branchName = branches.find(b => b.id === selectedBranch)?.name

    return {
      churchName: [orgName || 'CHURCH', branchName].filter(Boolean).join(' — ').toUpperCase(),
      reportTitle: `INCOME AND EXPENDITURE ACCOUNT FOR ${period}`,
      monthLabels,
      broughtForward: null,
      income: { categories: incomeCategories, grandTotal: sumRows(incomeCategories, 'GRAND TOTAL') },
      expenditure: {
        groups: [{
          groupName: null,
          categories: expenditureCategories,
          groupTotal: sumRows(expenditureCategories, 'TOTAL'),
        }],
        grandTotal: sumRows(expenditureCategories, 'GRAND TOTAL'),
      },
    }
  }

  function handleExportIncomeExpenditure(format: 'pdf' | 'excel') {
    const data = buildIncomeExpenditureData()
    if (!data) return
    if (format === 'excel') generateIncomeExpenditureExcel(data, `income-expenditure-${ieYear}`)
    else generateIncomeExpenditurePdf(data, `income-expenditure-${ieYear}`)
  }

  const avgAtt = weeklyAtt.length > 0
    ? (weeklyAtt.reduce((s, w) => s + Number(w.rate), 0) / weeklyAtt.length)
    : 0
  const bestWeek = weeklyAtt.length > 0 ? Math.max(...weeklyAtt.map(w => Number(w.rate))) : 0
  const totalHeadcount = weeklyAtt.reduce((s, w) => s + Number(w.present_count), 0)

  const totalMembersCount = memberGrowth.length > 0 ? Number(memberGrowth[memberGrowth.length - 1].cumulative) : 0
  const newThisMonth = memberGrowth.length > 0 ? Number(memberGrowth[memberGrowth.length - 1].new_members) : 0

  const filteredGroups = groups.filter(g => {
    if (!groupSearch) return true
    const q = groupSearch.toLowerCase()
    return g.name.toLowerCase().includes(q) || (g.ministry_name ?? '').toLowerCase().includes(q)
  })

  // ── Expense report derivations ───────────────────────────────────────────────
  // Income chart — identical shape to the expense chart: every real income
  // category is its own stacked series, indigo→grey ramp, biggest-first, no Other.
  const incomeChart = useMemo(() => {
    const monthsWanted = sortedIncMonths.map(m => `${incYear}-${String(m).padStart(2, '0')}`)
    const catTotals = new Map<string, number>()
    const perMonth = new Map<string, Map<string, number>>()
    monthsWanted.forEach(ym => perMonth.set(ym, new Map()))
    incRows.forEach(e => {
      const ym = String(e.expense_date).slice(0, 7)
      if (!perMonth.has(ym)) return
      const name = e.transaction_categories?.name ?? 'Uncategorised'
      catTotals.set(name, (catTotals.get(name) ?? 0) + Number(e.amount))
      const mm = perMonth.get(ym)!
      mm.set(name, (mm.get(name) ?? 0) + Number(e.amount))
    })
    const categories = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const colorOf = new Map(categories.map((n, i) => [n, expenseRamp(i, categories.length)]))
    const data = monthsWanted.map(ym => {
      const row: Record<string, number | string> = { month: ym }
      const mm = perMonth.get(ym)!
      categories.forEach(c => { row[c] = mm.get(c) ?? 0 })
      return row
    })
    const totalGiven = [...catTotals.values()].reduce((s, v) => s + v, 0)
    const catRows = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total }))
    return { data, categories, colorOf, totalGiven, catRows }
  }, [incRows, incYear, sortedIncMonths.join(',')])

  // Option A: every category is its own stacked series, coloured by the indigo→
  // grey ramp, ordered biggest-first. No "Other" bucket.
  const expenseChart = useMemo(() => {
    const monthsWanted = sortedExpMonths.map(m => `${expYear}-${String(m).padStart(2, '0')}`)
    // total per category across the window, to rank them
    const catTotals = new Map<string, number>()
    // per-month, per-category amounts
    const perMonth = new Map<string, Map<string, number>>()
    monthsWanted.forEach(ym => perMonth.set(ym, new Map()))
    expRows.forEach(e => {
      const ym = String(e.expense_date).slice(0, 7)
      if (!perMonth.has(ym)) return
      const name = e.transaction_categories?.name ?? 'Uncategorised'
      catTotals.set(name, (catTotals.get(name) ?? 0) + Number(e.amount))
      const mm = perMonth.get(ym)!
      mm.set(name, (mm.get(name) ?? 0) + Number(e.amount))
    })
    // categories ordered biggest first
    const categories = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const colorOf = new Map(categories.map((n, i) => [n, expenseRamp(i, categories.length)]))
    // one row per selected month, every category present (0 when absent → blank stack)
    const data = monthsWanted.map(ym => {
      const row: Record<string, number | string> = { month: ym }
      const mm = perMonth.get(ym)!
      categories.forEach(c => { row[c] = mm.get(c) ?? 0 })
      return row
    })
    const catRows = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({
        category, total,
        cnt: expRows.filter(e => (e.transaction_categories?.name ?? 'Uncategorised') === category
          && perMonth.has(String(e.expense_date).slice(0, 7))).length,
      }))
    const totalSpent = [...catTotals.values()].reduce((s, v) => s + v, 0)
    // biggest month by total
    let biggest = ''; let biggestVal = -1
    perMonth.forEach((mm, ym) => {
      const t = [...mm.values()].reduce((s, v) => s + v, 0)
      if (t > biggestVal) { biggestVal = t; biggest = ym }
    })
    return { data, categories, colorOf, catRows, totalSpent, biggest: biggestVal > 0 ? biggest : '' }
  }, [expRows, expYear, sortedExpMonths.join(',')])

  // ── Styles ───────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '20px 20px',
  }
  const periodBtn = (active: boolean): React.CSSProperties => ({
    height: 30, padding: '0 12px', borderRadius: 6,
    border: `0.5px solid ${active ? '#4F6BED' : 'var(--dm-border-soft)'}`,
    background: active ? 'var(--avatar-1-bg)' : 'var(--dm-bg-card)',
    color: active ? '#4F6BED' : 'var(--dm-text-secondary)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 12.5, cursor: 'pointer',
  })
  const selectSt: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border-soft)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)',
    padding: '0 10px', background: 'var(--dm-bg-card)', outline: 'none',
  }
  const th: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500,
    fontSize: 11.5, color: 'var(--dm-text-secondary)', padding: '9px 12px', textAlign: 'left',
    borderBottom: '0.5px solid var(--dm-border-soft)', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-body)', padding: '10px 12px',
    borderBottom: '0.5px solid var(--dm-border-subtle)',
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: isMobile ? 0 : '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 0, marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.02em' }}>
            Reports
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)', marginTop: 3 }}>
            Giving, attendance, member growth, and group analytics
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* I&E account export — Income tab only. Its month/year pickers drive
              only the PDF, independent of the giving chart's own filter. */}
          {activeTab === 'giving' && (
            <>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIeMenuOpen(o => !o)} style={{ ...selectSt, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 120, justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {sortedIeMonths.length === 0 ? 'Months' : sortedIeMonths.length === 12 ? 'All months' : sortedIeMonths.map(m => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {ieMenuOpen && (
                  <>
                    <div onClick={() => setIeMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 210, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 21 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>Export months</span>
                        <span role="button" onClick={() => setIeMonths(ieMonths.length === 12 ? [] : Array.from({ length: 12 }, (_, i) => i + 1))} style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#4F6BED', cursor: 'pointer' }}>
                          {ieMonths.length === 12 ? 'Clear all' : 'Select all'}
                        </span>
                      </div>
                      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {MONTH_NAMES.map((name, i) => (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', borderRadius: 6, cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <input type="checkbox" checked={ieMonths.includes(i + 1)} onChange={() => toggleIeMonth(i + 1)} style={{ accentColor: '#4F6BED' }} />
                            {name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <select value={ieYear} onChange={e => setIeYear(Number(e.target.value))} style={{ ...selectSt, cursor: 'pointer' }}>
                {expYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                {(() => {
                  const ieDisabled = sortedIeMonths.length === 0 || (ieRows.income.length === 0 && ieRows.expense.length === 0)
                  return (
                    <button
                      onClick={() => { if (!ieDisabled) setIeExportMenuOpen(o => !o) }}
                      disabled={ieDisabled}
                      title="Download the Income & Expenditure account for the selected months"
                      style={{ ...selectSt, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: ieDisabled ? 'not-allowed' : 'pointer', opacity: ieDisabled ? 0.5 : 1 }}
                    >
                      <DownloadIcon /> I&amp;E Account
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )
                })()}
                {ieExportMenuOpen && (
                  <>
                    <div onClick={() => setIeExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 150, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 5, zIndex: 21 }}>
                      {(['pdf', 'excel'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => { setIeExportMenuOpen(false); handleExportIncomeExpenditure(fmt) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <DownloadIcon /> {fmt === 'pdf' ? 'PDF' : 'Excel'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {user?.role === 'super_admin' && branches.length > 0 && (
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ ...selectSt, width: isMobile ? '100%' : undefined }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Top-level group navigation: Income / Expense / Others */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid var(--dm-border-soft)', marginBottom: GROUP_TABS[activeGroup].length > 1 ? 14 : 28 }}>
        {visibleGroups.map(g => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            style={{
              height: 38, padding: '0 16px', border: 'none', background: 'none',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: activeGroup === g ? 600 : 400,
              fontSize: 13.5, cursor: 'pointer', color: activeGroup === g ? '#4F6BED' : '#6B7280',
              borderBottom: activeGroup === g ? '2px solid #4F6BED' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.1s',
            }}
            onMouseEnter={e => { if (activeGroup !== g) e.currentTarget.style.color = 'var(--dm-text-body)' }}
            onMouseLeave={e => { if (activeGroup !== g) e.currentTarget.style.color = 'var(--dm-text-secondary)' }}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      {/* Sub-tab navigation — only when the active group has more than one sub-tab (Others) */}
      {GROUP_TABS[activeGroup].length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {GROUP_TABS[activeGroup].filter(t => visibleReportTabs.includes(t)).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                height: 30, padding: '0 14px', borderRadius: 999,
                border: activeTab === t ? '0.5px solid #111827' : '0.5px solid var(--dm-border)',
                background: activeTab === t ? '#111827' : 'var(--dm-bg-card)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500,
                fontSize: 13, cursor: 'pointer',
                color: activeTab === t ? '#fff' : 'var(--dm-text-body)',
                transition: 'all 0.1s', textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── GIVING TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'giving' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Given" value={fGHS(incomeChart.totalGiven)} sub={sortedIncMonths.length === 1 ? `${MONTH_NAMES[sortedIncMonths[0] - 1]} ${incYear}` : `${sortedIncMonths.length} months of ${incYear}`} accent="#4F6BED" />
            <StatCard label="Top Givers (Total)" value={topGivers.length > 0 ? fGHS(topGivers.reduce((s, g) => s + Number(g.total_given), 0)) : '—'} sub="Top 10 contributors" accent="#C8964A" />
            <StatCard label="Categories" value={incomeChart.categories.length} sub="Giving categories with activity" accent="#7B93F5" />
          </div>

          {/* Month/year filter + Stacked bar (real categories, indigo ramp) */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>
                Monthly Giving by Category
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setIncMenuOpen(o => !o)} style={{ ...periodBtn(false), display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 150, justifyContent: 'space-between' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                      {sortedIncMonths.length === 0 ? 'Select months' : sortedIncMonths.length === 12 ? 'All months' : sortedIncMonths.map(m => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {incMenuOpen && (
                    <>
                      <div onClick={() => setIncMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 220, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 21 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>Months</span>
                          <span role="button" onClick={() => setIncMonths(incMonths.length === 12 ? [] : Array.from({ length: 12 }, (_, i) => i + 1))} style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#4F6BED', cursor: 'pointer' }}>
                            {incMonths.length === 12 ? 'Clear all' : 'Select all'}
                          </span>
                        </div>
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {MONTH_NAMES.map((name, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', borderRadius: 6, cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <input type="checkbox" checked={incMonths.includes(i + 1)} onChange={() => toggleIncMonth(i + 1)} style={{ accentColor: '#4F6BED' }} />
                              {name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <select value={incYear} onChange={e => setIncYear(Number(e.target.value))} style={{ ...periodBtn(false), cursor: 'pointer', paddingRight: 8 }}>
                  {expYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => setExportGiving('trend')} disabled={incomeChart.categories.length === 0} style={{ ...periodBtn(false), marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: incomeChart.categories.length === 0 ? 0.5 : 1 }}>
                  <DownloadIcon /> Export
                </button>
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', marginBottom: 16 }}>
              Pick the months and year to view. Applies to the chart and the CSV / Excel / PDF export.
            </div>
            {loadingGiving ? <Skeleton h={220} /> : sortedIncMonths.length === 0 ? <EmptyState message="Select at least one month to view" /> : incomeChart.categories.length === 0 ? <EmptyState message="No giving recorded for this range" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={incomeChart.data} margin={{ top: 0, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fGHS(v)} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<ExpenseTooltip />} cursor={{ fill: 'var(--dm-bg-muted)', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {incomeChart.categories.map((c, i) => (
                    <Bar key={c} dataKey={c} stackId="a" fill={incomeChart.colorOf.get(c)} name={c}
                      radius={i === incomeChart.categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      minPointSize={0} isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category donut + By branch */}
          <div style={{ display: 'grid', gridTemplateColumns: (isMobile || isTablet) ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Category donut */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 16 }}>By Category</div>
              {loadingGiving ? <Skeleton h={180} /> : incomeChart.catRows.length === 0 ? <EmptyState message="No data" /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={incomeChart.catRows} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="total" paddingAngle={2}>
                        {incomeChart.catRows.map(c => <Cell key={c.category} fill={incomeChart.colorOf.get(c.category)} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fGHSFull(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {incomeChart.catRows.map(c => {
                      const total = incomeChart.totalGiven
                      const pct = total > 0 ? Math.round((Number(c.total) / total) * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: incomeChart.colorOf.get(c.category), flexShrink: 0 }} />
                          <div style={{ flex: 1, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', textTransform: 'capitalize' }}>{c.category}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: 'var(--dm-text-secondary)' }}>{pct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* By branch — only when org-wide view */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 16 }}>By Branch</div>
              {loadingGiving ? <Skeleton h={180} /> : givingByBranch.length === 0 ? (
                <EmptyState message={selectedBranch ? 'Select "All Branches" to see this view' : 'No branch data'} />
              ) : (
                <BarChart width={500} height={180} data={givingByBranch} layout="vertical" margin={{ top: 0, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => fGHS(v)} tick={{ fontSize: 10.5, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="branch_name" width={80} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fGHSFull(v)} />
                  <Bar dataKey="total" fill="#4F6BED" radius={[0, 4, 4, 0]} minPointSize={0} isAnimationActive={false} />
                </BarChart>
              )}
            </div>
          </div>

          {/* Top Givers table */}
          <div style={card}>
            <SectionHeader title="Top Givers" onExport={() => setExportGiving('givers')} />
            {loadingGiving ? <Skeleton h={200} /> : topGivers.length === 0 ? <EmptyState message="No giving records for this period" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>Member</th>
                      <th style={th}>Branch</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total Given</th>
                      <th style={{ ...th, textAlign: 'right' }}>Gifts</th>
                      <th style={{ ...th, textAlign: 'right' }}>Last Gift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topGivers.map((g, i) => (
                      <tr key={`${g.member_id}-${i}`} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--avatar-1-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)')}
                      >
                        <td style={{ ...td, color: 'var(--dm-text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: 32 }}>{i + 1}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={g.first_name} lastName={g.last_name} size={28} />
                            <div>
                              <div
                                onClick={() => navigate(`/members/${g.member_id}`)}
                                role="button" onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}
                                style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--dm-text-ink)' }}
                              >
                                {g.first_name} {g.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>{g.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{g.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: 'var(--dm-text-ink)' }}>{fGHSFull(g.total_given)}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--dm-text-secondary)' }}>{g.gift_count}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>{fDate(g.last_gift_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPENSE TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'expense' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards — default to current month, follow the filter once changed */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Spent" value={fGHS(expenseChart.totalSpent)} sub={sortedExpMonths.length === 1 ? `${MONTH_NAMES[sortedExpMonths[0] - 1]} ${expYear}` : `${sortedExpMonths.length} months of ${expYear}`} accent="#4F6BED" />
            <StatCard label="Categories" value={expenseChart.categories.length} sub="Expense categories with activity" accent="#7B93F5" />
            <StatCard label="Biggest Month" value={expenseChart.biggest ? monthLabel(expenseChart.biggest) : '—'} sub="Highest spend in range" accent="#C8964A" />
          </div>

          {/* Month/year filter + Stacked bar */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>
                Monthly Expense by Category
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Month multi-select */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setExpMenuOpen(o => !o)}
                    style={{ ...periodBtn(false), display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 150, justifyContent: 'space-between' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                      {sortedExpMonths.length === 0 ? 'Select months'
                        : sortedExpMonths.length === 12 ? 'All months'
                        : sortedExpMonths.map(m => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {expMenuOpen && (
                    <>
                      <div onClick={() => setExpMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 220, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 21 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>Months</span>
                          <span
                            role="button"
                            onClick={() => setExpMonths(expMonths.length === 12 ? [] : Array.from({ length: 12 }, (_, i) => i + 1))}
                            style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#4F6BED', cursor: 'pointer' }}
                          >
                            {expMonths.length === 12 ? 'Clear all' : 'Select all'}
                          </span>
                        </div>
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {MONTH_NAMES.map((name, i) => {
                            const m = i + 1
                            return (
                              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', borderRadius: 6, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <input type="checkbox" checked={expMonths.includes(m)} onChange={() => toggleExpMonth(m)} style={{ accentColor: '#4F6BED' }} />
                                {name}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {/* Year select */}
                <select value={expYear} onChange={e => setExpYear(Number(e.target.value))} style={{ ...periodBtn(false), cursor: 'pointer', paddingRight: 8 }}>
                  {expYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button
                  onClick={() => setExportExpense('trend')}
                  disabled={expenseChart.categories.length === 0}
                  style={{ ...periodBtn(false), marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: expenseChart.categories.length === 0 ? 0.5 : 1 }}
                >
                  <DownloadIcon /> Export
                </button>
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', marginBottom: 16 }}>
              Pick the months and year to view. Applies to the chart and every export.
            </div>
            {loadingExpense ? <Skeleton h={220} /> : sortedExpMonths.length === 0 ? <EmptyState message="Select at least one month to view" /> : expenseChart.categories.length === 0 ? <EmptyState message="No expenses recorded for this range" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={expenseChart.data} margin={{ top: 0, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fGHS(v)} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<ExpenseTooltip />} cursor={{ fill: 'var(--dm-bg-muted)', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {expenseChart.categories.map((c, i) => (
                    <Bar
                      key={c}
                      dataKey={c}
                      stackId="a"
                      fill={expenseChart.colorOf.get(c)}
                      name={c}
                      radius={i === expenseChart.categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      minPointSize={0}
                      isAnimationActive
                      animationBegin={0}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category breakdown table */}
          <div style={card}>
            <SectionHeader title="By Category" onExport={expenseChart.catRows.length > 0 ? () => setExportExpense('cats') : undefined} />
            {loadingExpense ? <Skeleton h={180} /> : expenseChart.catRows.length === 0 ? <EmptyState message="No expenses recorded for this range" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Category</th>
                      <th style={{ ...th, textAlign: 'right' }}>Entries</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total Spent</th>
                      <th style={{ ...th, textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseChart.catRows.map((c, i) => {
                      const grand = expenseChart.totalSpent
                      const pct = grand > 0 ? Math.round((Number(c.total) / grand) * 100) : 0
                      return (
                        <tr key={c.category} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)' }}>
                          <td style={{ ...td, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize', fontWeight: 500, color: 'var(--dm-text-ink)' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: expenseChart.colorOf.get(c.category), border: '0.5px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                            {c.category}
                          </td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--dm-text-secondary)' }}>{c.cnt}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: 'var(--dm-text-ink)' }}>{fGHSFull(c.total)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Avg Attendance Rate" value={weeklyAtt.length > 0 ? `${avgAtt.toFixed(1)}%` : '—'} sub={`Last ${attWeeks} weeks`} accent="#4F6BED" />
            <StatCard label="Total Headcount" value={totalHeadcount.toLocaleString()} sub="Sum of all weekly present" accent="#7B93F5" />
            <StatCard label="Best Week" value={weeklyAtt.length > 0 ? `${bestWeek.toFixed(1)}%` : '—'} sub="Peak attendance rate" accent="#22C55E" />
          </div>

          {/* Weekly trend */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>
                Weekly Attendance Rate
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([4, 8, 12, 24] as AttWeeks[]).map(w => (
                  <button key={w} style={periodBtn(attWeeks === w)} onClick={() => setAttWeeks(w)}>{w}W</button>
                ))}
              </div>
            </div>
            {loadingAtt ? <Skeleton h={220} /> : weeklyAtt.length === 0 ? <EmptyState message="No attendance data for this period" /> : (
              <LineChart width={700} height={220} data={weeklyAtt} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                <XAxis dataKey="week_start" tickFormatter={fShortDate} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<AttTooltip />} />
                <Line type="monotone" dataKey="rate" stroke="#4F6BED" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#4F6BED' }} isAnimationActive={false} />
              </LineChart>
            )}
          </div>

          {/* By event type */}
          <div style={card}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 16 }}>
              Attendance by Event Type
            </div>
            {loadingAtt ? <Skeleton h={180} /> : attByType.length === 0 ? <EmptyState message="No event type data" /> : (
              <BarChart width={700} height={180} data={attByType} margin={{ top: 0, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                <XAxis dataKey="event_type" tickFormatter={fEventType} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={fEventType} />
                <Bar dataKey="avg_rate" fill="#7B93F5" radius={[4, 4, 0, 0]} name="Avg Rate (%)" minPointSize={0} isAnimationActive={false} />
              </BarChart>
            )}
          </div>

          {/* Members at risk */}
          <div style={card}>
            <SectionHeader title={`Members at Risk (${atRisk.length})`} onExport={atRisk.length > 0 ? () => setExportAtRisk(true) : undefined} />
            {loadingAtt ? <Skeleton h={200} /> : atRisk.length === 0 ? (
              <EmptyState message="No members flagged — great engagement!" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Member</th>
                      <th style={th}>Branch</th>
                      <th style={th}>Group</th>
                      <th style={{ ...th, textAlign: 'right' }}>Last Seen</th>
                      <th style={{ ...th, textAlign: 'right' }}>Days Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRisk.map((m, i) => (
                      <tr key={`${m.id}-${i}`} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--badge-pending-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--dm-text-ink)' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{m.group_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>{fDate(m.last_seen)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: m.days_since > 60 ? '#EF4444' : '#F59E0B', background: m.days_since > 60 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                            {m.days_since}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MEMBERS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Members" value={totalMembersCount.toLocaleString()} sub="Cumulative (12 months)" accent="#4F6BED" />
            <StatCard label="New This Month" value={newThisMonth} sub="Joined in current month" accent="#22C55E" />
            <StatCard label="Birthdays This Month" value={birthdays.length} sub="Active members" accent="#C8964A" />
          </div>

          {/* Growth chart */}
          <div style={card}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 20 }}>
              Membership Growth
            </div>
            {loadingMembers ? <Skeleton h={220} /> : memberGrowth.length === 0 ? <EmptyState message="No member growth data" /> : (
              <ComposedChart width={700} height={220} data={memberGrowth} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={36} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="new_members" fill="var(--avatar-1-bg)" radius={[3, 3, 0, 0]} name="New Members" minPointSize={0} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#4F6BED" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Cumulative" isAnimationActive={false} />
              </ComposedChart>
            )}
          </div>

          {/* Gender donut + Age breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: (isMobile || isTablet) ? '1fr' : '1fr 1.6fr', gap: 16 }}>
            {/* Gender */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 16 }}>Gender Breakdown</div>
              {loadingMembers ? <Skeleton h={160} /> : genderBreakdown.length === 0 ? <EmptyState message="No data" /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={genderBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="cnt" paddingAngle={2}>
                        {genderBreakdown.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {genderBreakdown.map((g, i) => {
                      const total = genderBreakdown.reduce((s, r) => s + Number(r.cnt), 0)
                      const pct = total > 0 ? Math.round((Number(g.cnt) / total) * 100) : 0
                      return (
                        <div key={g.gender}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', textTransform: 'capitalize' }}>{g.gender}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: 'var(--dm-text-secondary)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--dm-bg-muted)' }}>
                            <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: GENDER_COLORS[i % GENDER_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Age breakdown */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 16 }}>Age Breakdown</div>
              {loadingMembers ? <Skeleton h={160} /> : ageBreakdown.length === 0 ? <EmptyState message="No age data available" /> : (
                <BarChart width={500} height={160} data={ageBreakdown} margin={{ top: 0, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dm-chart-grid)" vertical={false} />
                  <XAxis dataKey="age_group" tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--dm-chart-tick)' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="cnt" fill="#7B93F5" radius={[3, 3, 0, 0]} name="Members" minPointSize={0} isAnimationActive={false} />
                </BarChart>
              )}
            </div>
          </div>

          {/* New member follow-up */}
          <div style={card}>
            <SectionHeader title={`New Member Follow-up (Last 90 Days · ${newMembers.length})`} onExport={newMembers.length > 0 ? () => setExportNewMembers(true) : undefined} />
            {loadingMembers ? <Skeleton h={200} /> : newMembers.length === 0 ? <EmptyState message="No new members in the last 90 days" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Member</th>
                      <th style={th}>Branch</th>
                      <th style={{ ...th, textAlign: 'right' }}>Joined</th>
                      <th style={{ ...th, textAlign: 'center' }}>In Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newMembers.map((m, i) => (
                      <tr key={`${m.id}-${i}`} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--avatar-1-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--dm-text-ink)' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>{fDate(m.created_at)}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 500, color: m.in_group ? 'var(--badge-active-fg)' : 'var(--badge-pending-fg)', background: m.in_group ? 'var(--badge-active-bg)' : 'var(--badge-pending-bg)', padding: '2px 8px', borderRadius: 6 }}>
                            {m.in_group ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Birthdays */}
          <div style={card}>
            <SectionHeader title={`Birthdays This Month (${birthdays.length})`} onExport={birthdays.length > 0 ? () => setExportBirthdays(true) : undefined} />
            {loadingMembers ? <Skeleton h={160} /> : birthdays.length === 0 ? <EmptyState message="No birthdays this month" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Member</th>
                      <th style={th}>Branch</th>
                      <th style={{ ...th, textAlign: 'right' }}>Date of Birth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdays.map((m, i) => (
                      <tr key={`${m.id}-${i}`} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--badge-pending-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--dm-text-ink)' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>
                          {new Date(m.date_of_birth).toLocaleDateString('en-GH', { day: 'numeric', month: 'long' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GROUPS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Groups" value={groups.length} sub="All groups" accent="#4F6BED" />
            <StatCard label="Active Groups" value={groups.filter(g => g.is_active).length} sub="Currently active" accent="#22C55E" />
            <StatCard label="Total Members in Groups" value={groups.reduce((s, g) => s + g.member_count, 0).toLocaleString()} sub="Across all groups" accent="#7B93F5" />
          </div>

          {/* Groups table */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)' }}>All Groups</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><SearchIcon /></div>
                  <input
                    type="text" placeholder="Search groups…" value={groupSearch}
                    onChange={e => setGroupSearch(e.target.value)}
                    style={{ height: 34, paddingLeft: 32, paddingRight: 12, borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', outline: 'none', width: 200, background: 'var(--dm-bg-card)' }}
                  />
                </div>
                {filteredGroups.length > 0 && (
                  <button
                    onClick={() => setExportGroups(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--dm-text-body)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--dm-bg-surface)'; e.currentTarget.style.borderColor = 'var(--dm-border-strong)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--dm-bg-card)'; e.currentTarget.style.borderColor = 'var(--dm-border-soft)' }}
                  >
                    <DownloadIcon /> Export
                  </button>
                )}
              </div>
            </div>
            {loadingGroups ? <Skeleton h={220} /> : filteredGroups.length === 0 ? <EmptyState message={groupSearch ? 'No groups match your search' : 'No groups found'} /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Group</th>
                      <th style={th}>Ministry</th>
                      <th style={th}>Branch</th>
                      <th style={{ ...th, textAlign: 'right' }}>Members</th>
                      <th style={th}>Leader</th>
                      <th style={{ ...th, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((g, i) => (
                      <tr key={`${g.id}-${i}`} style={{ background: i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--avatar-1-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--dm-bg-card)' : 'var(--dm-bg-surface)')}
                      >
                        <td style={{ ...td, fontWeight: 500, color: 'var(--dm-text-ink)' }}>{g.name}</td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{g.ministry_name || '—'}</td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{g.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--dm-text-body)' }}>{g.member_count}</td>
                        <td style={{ ...td, color: 'var(--dm-text-secondary)' }}>{g.leader_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 500, color: g.is_active ? 'var(--badge-active-fg)' : 'var(--badge-inactive-fg)', background: g.is_active ? 'var(--badge-active-bg)' : 'var(--badge-inactive-bg)', padding: '2px 8px', borderRadius: 6 }}>
                            {g.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPORT MODALS ───────────────────────────────────────────────────── */}

      {exportGiving === 'trend' && (
        <ExportModal
          title="Monthly Giving by Category"
          columns={['Month', ...incomeChart.categories, 'Total']}
          rows={incomeChart.data.map(r => {
            const cells = incomeChart.categories.map(c => fGHSFull(Number(r[c] ?? 0)))
            const total = incomeChart.categories.reduce((sm, c) => sm + Number(r[c] ?? 0), 0)
            return [monthLabel(String(r.month)), ...cells, fGHSFull(total)]
          })}
          filename={`giving-by-category-${incYear}`}
          onClose={() => setExportGiving(null)}
        />
      )}
      {exportGiving === 'givers' && (
        <ExportModal
          title="Top Givers"
          columns={['Member', 'Member #', 'Branch', 'Total Given', 'Gifts', 'Last Gift']}
          rows={topGivers.map(g => [
            `${g.first_name} ${g.last_name}`, g.member_number,
            g.branch_name, fGHSFull(g.total_given), g.gift_count, fDate(g.last_gift_date),
          ])}
          filename="top-givers"
          onClose={() => setExportGiving(null)}
        />
      )}
      {exportExpense === 'trend' && (
        <ExportModal
          title="Monthly Expense by Category"
          columns={['Month', ...expenseChart.categories, 'Total']}
          rows={expenseChart.data.map(r => {
            const cells = expenseChart.categories.map(c => fGHSFull(Number(r[c] ?? 0)))
            const total = expenseChart.categories.reduce((s, c) => s + Number(r[c] ?? 0), 0)
            return [monthLabel(String(r.month)), ...cells, fGHSFull(total)]
          })}
          filename={`expense-by-category-${expYear}`}
          onClose={() => setExportExpense(null)}
        />
      )}
      {exportExpense === 'cats' && (
        <ExportModal
          title="Expense by Category"
          columns={['Category', 'Entries', 'Total Spent']}
          rows={expenseChart.catRows.map(c => [c.category, c.cnt, fGHSFull(c.total)])}
          filename={`expense-categories-${expYear}`}
          onClose={() => setExportExpense(null)}
        />
      )}
      {exportAtRisk && (
        <ExportModal
          title="Members at Risk"
          columns={['Name', 'Member #', 'Branch', 'Group', 'Last Seen', 'Days Absent']}
          rows={atRisk.map(m => [
            `${m.first_name} ${m.last_name}`, m.member_number,
            m.branch_name, m.group_name, fDate(m.last_seen), m.days_since,
          ])}
          filename="members-at-risk"
          onClose={() => setExportAtRisk(false)}
        />
      )}
      {exportNewMembers && (
        <ExportModal
          title="New Member Follow-up"
          columns={['Name', 'Member #', 'Branch', 'Joined', 'In Group']}
          rows={newMembers.map(m => [
            `${m.first_name} ${m.last_name}`, m.member_number,
            m.branch_name ?? '—', fDate(m.created_at), m.in_group ? 'Yes' : 'No',
          ])}
          filename="new-member-followup"
          onClose={() => setExportNewMembers(false)}
        />
      )}
      {exportBirthdays && (
        <ExportModal
          title="Birthdays This Month"
          columns={['Name', 'Member #', 'Branch', 'Date of Birth']}
          rows={birthdays.map(m => [
            `${m.first_name} ${m.last_name}`, m.member_number,
            m.branch_name ?? '—',
            new Date(m.date_of_birth).toLocaleDateString('en-GH', { day: 'numeric', month: 'long' }),
          ])}
          filename="birthdays-this-month"
          onClose={() => setExportBirthdays(false)}
        />
      )}
      {exportGroups && (
        <ExportModal
          title="All Groups"
          columns={['Group', 'Ministry', 'Branch', 'Members', 'Leader', 'Status']}
          rows={filteredGroups.map(g => [
            g.name, g.ministry_name ?? '—', g.branch_name ?? '—',
            g.member_count, g.leader_name ?? '—', g.is_active ? 'Active' : 'Inactive',
          ])}
          filename="groups-report"
          onClose={() => setExportGroups(false)}
        />
      )}

      {/* Unused import guard */}
      {false && <AlertIcon />}
    </div>
  )
}

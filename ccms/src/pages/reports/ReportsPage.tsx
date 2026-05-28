import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ExportModal } from '../../components/ExportModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = 'giving' | 'attendance' | 'members' | 'groups'
type GivingPeriod = '3M' | '6M' | '12M'
type AttWeeks = 4 | 8 | 12 | 24

interface Branch { id: string; name: string }

interface MonthlyGivingCat {
  month: string; tithe: number; offering: number; building: number; other_amount: number
}
interface CatBreakdown { category: string; total: number }
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

const DONUT_COLORS = ['#C8964A', '#4F6BED', '#7B93F5', '#22C55E', '#9CA3AF']
const GENDER_COLORS = ['#4F6BED', '#EC4899']
const AP = [
  { bg: '#E8ECF9', color: '#4F6BED' }, { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' }, { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' }, { bg: '#FFF7ED', color: '#C2410C' },
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
      <div style={{ height: h, borderRadius: r, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
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
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>{title}</div>
      {onExport && (
        <button
          onClick={onExport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: '#374151' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E5E7EB' }}
        >
          <DownloadIcon /> Export
        </button>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#9CA3AF', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13 }}>
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

function GivingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; fill: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{monthLabel(label ?? '')}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#374151', marginBottom: 2 }}>
          <span style={{ color: '#6B7280' }}>{p.name}</span>
          <span>{fGHSFull(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '0.5px solid #F3F4F6', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: '#111827' }}>
        <span>Total</span><span>{fGHSFull(total)}</span>
      </div>
    </div>
  )
}

function AttTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Wk of {fShortDate(label)}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#111827', fontWeight: 600 }}>{Number(payload[0]?.value ?? 0).toFixed(1)}%</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') ?? 'giving') as ReportTab
  function setTab(t: ReportTab) { setSearchParams({ tab: t }) }

  // Shared
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const branchId = selectedBranch || null

  // Giving tab
  const [givingPeriod, setGivingPeriod] = useState<GivingPeriod>('12M')
  const [givingByCat, setGivingByCat] = useState<MonthlyGivingCat[]>([])
  const [catBreakdown, setCatBreakdown] = useState<CatBreakdown[]>([])
  const [topGivers, setTopGivers] = useState<TopGiver[]>([])
  const [givingByBranch, setGivingByBranch] = useState<GivingByBranch[]>([])
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
    if (user.role === 'pastor' && user.branch_id) setSelectedBranch(user.branch_id)
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
      const [byCat, byBranch, top, cat] = await Promise.all([
        supabase.rpc('get_monthly_giving_by_category', { p_org_id: orgId, p_branch_id: bId, p_months: months }),
        !bId ? supabase.rpc('get_giving_by_branch', { p_org_id: orgId, p_start: start, p_end: end }) : Promise.resolve({ data: [] }),
        supabase.rpc('get_top_givers', { p_org_id: orgId, p_branch_id: bId, p_start: start, p_end: end, p_limit: 10 }),
        supabase.rpc('get_category_breakdown', { p_org_id: orgId, p_branch_id: bId, p_start: start, p_end: end }),
      ])
      setGivingByCat((byCat.data ?? []) as MonthlyGivingCat[])
      setGivingByBranch((byBranch.data ?? []) as GivingByBranch[])
      setTopGivers((top.data ?? []) as TopGiver[])
      setCatBreakdown((cat.data ?? []) as CatBreakdown[])
    } finally {
      setLoadingGiving(false)
    }
  }, [user?.org_id, selectedBranch, activeTab, givingPeriod])

  useEffect(() => { fetchGiving() }, [fetchGiving])

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
      setAtRisk((risk.data ?? []) as AtRisk[])
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

  const givingTotal = givingByCat.reduce((s, r) => s + Number(r.tithe) + Number(r.offering) + Number(r.building) + Number(r.other_amount), 0)

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

  // ── Styles ───────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '20px 20px',
  }
  const periodBtn = (active: boolean): React.CSSProperties => ({
    height: 30, padding: '0 12px', borderRadius: 6,
    border: `0.5px solid ${active ? '#4F6BED' : '#E5E7EB'}`,
    background: active ? '#EEF1FD' : '#fff',
    color: active ? '#4F6BED' : '#6B7280',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 12.5, cursor: 'pointer',
  })
  const selectSt: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151',
    padding: '0 10px', background: '#fff', outline: 'none',
  }
  const th: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500,
    fontSize: 11.5, color: '#6B7280', padding: '9px 12px', textAlign: 'left',
    borderBottom: '0.5px solid #E5E7EB', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#374151', padding: '10px 12px',
    borderBottom: '0.5px solid #F3F4F6',
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: '#111827', letterSpacing: '-0.02em' }}>
            Reports
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>
            Giving, attendance, member growth, and group analytics
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.role !== 'pastor' && branches.length > 0 && (
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={selectSt}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid #E5E7EB', marginBottom: 28 }}>
        {(['giving', 'attendance', 'members', 'groups'] as ReportTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              height: 38, padding: '0 16px', border: 'none', background: 'none',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: activeTab === t ? 600 : 400,
              fontSize: 13.5, cursor: 'pointer', color: activeTab === t ? '#4F6BED' : '#6B7280',
              borderBottom: activeTab === t ? '2px solid #4F6BED' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.1s',
              textTransform: 'capitalize',
            }}
            onMouseEnter={e => { if (activeTab !== t) e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (activeTab !== t) e.currentTarget.style.color = '#6B7280' }}
          >
            {t === 'giving' ? 'Giving' : t === 'attendance' ? 'Attendance' : t === 'members' ? 'Members' : 'Groups'}
          </button>
        ))}
      </div>

      {/* ── GIVING TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'giving' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Given" value={fGHS(givingTotal)} sub={`${givingPeriod} period`} accent="#4F6BED" />
            <StatCard label="Top Givers (Total)" value={topGivers.length > 0 ? fGHS(topGivers.reduce((s, g) => s + Number(g.total_given), 0)) : '—'} sub="Top 10 contributors" accent="#C8964A" />
            <StatCard label="Categories" value={catBreakdown.length} sub="Giving categories with activity" accent="#7B93F5" />
          </div>

          {/* Period toggle + Stacked bar */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>
                Monthly Giving by Category
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(['3M', '6M', '12M'] as GivingPeriod[]).map(p => (
                  <button key={p} style={periodBtn(givingPeriod === p)} onClick={() => setGivingPeriod(p)}>{p}</button>
                ))}
                <button
                  onClick={() => setExportGiving('trend')}
                  style={{ ...periodBtn(false), marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <DownloadIcon /> Export
                </button>
              </div>
            </div>
            {loadingGiving ? <Skeleton h={220} /> : givingByCat.length === 0 ? <EmptyState message="No giving data for this period" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={givingByCat} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fGHS(v)} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<GivingTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12 }} />
                  <Bar dataKey="tithe" stackId="a" fill="#4F6BED" name="Tithe" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="offering" stackId="a" fill="#C8964A" name="Offering" />
                  <Bar dataKey="building" stackId="a" fill="#7B93F5" name="Building" />
                  <Bar dataKey="other_amount" stackId="a" fill="#9CA3AF" name="Other" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category donut + By branch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Category donut */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 16 }}>By Category</div>
              {loadingGiving ? <Skeleton h={180} /> : catBreakdown.length === 0 ? <EmptyState message="No data" /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="total" paddingAngle={2}>
                        {catBreakdown.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fGHSFull(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {catBreakdown.map((c, i) => {
                      const total = catBreakdown.reduce((s, r) => s + Number(r.total), 0)
                      const pct = total > 0 ? Math.round((Number(c.total) / total) * 100) : 0
                      return (
                        <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                          <div style={{ flex: 1, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>{c.category}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#6B7280' }}>{pct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* By branch — only when org-wide view */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 16 }}>By Branch</div>
              {loadingGiving ? <Skeleton h={180} /> : givingByBranch.length === 0 ? (
                <EmptyState message={selectedBranch ? 'Select "All Branches" to see this view' : 'No branch data'} />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={givingByBranch} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => fGHS(v)} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="branch_name" width={80} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => fGHSFull(v)} />
                    <Bar dataKey="total" fill="#4F6BED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                      <tr key={g.member_id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EEF1FD')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB')}
                      >
                        <td style={{ ...td, color: '#9CA3AF', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: 32 }}>{i + 1}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={g.first_name} lastName={g.last_name} size={28} />
                            <div>
                              <div
                                onClick={() => navigate(`/members/${g.member_id}`)}
                                role="button" onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#111827')}
                                style={{ cursor: 'pointer', fontWeight: 500, color: '#111827' }}
                              >
                                {g.first_name} {g.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{g.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: '#6B7280' }}>{g.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>{fGHSFull(g.total_given)}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#6B7280' }}>{g.gift_count}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{fDate(g.last_gift_date)}</td>
                      </tr>
                    ))}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Avg Attendance Rate" value={weeklyAtt.length > 0 ? `${avgAtt.toFixed(1)}%` : '—'} sub={`Last ${attWeeks} weeks`} accent="#4F6BED" />
            <StatCard label="Total Headcount" value={totalHeadcount.toLocaleString()} sub="Sum of all weekly present" accent="#7B93F5" />
            <StatCard label="Best Week" value={weeklyAtt.length > 0 ? `${bestWeek.toFixed(1)}%` : '—'} sub="Peak attendance rate" accent="#22C55E" />
          </div>

          {/* Weekly trend */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>
                Weekly Attendance Rate
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([4, 8, 12, 24] as AttWeeks[]).map(w => (
                  <button key={w} style={periodBtn(attWeeks === w)} onClick={() => setAttWeeks(w)}>{w}W</button>
                ))}
              </div>
            </div>
            {loadingAtt ? <Skeleton h={220} /> : weeklyAtt.length === 0 ? <EmptyState message="No attendance data for this period" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyAtt} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="week_start" tickFormatter={fShortDate} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<AttTooltip />} />
                  <Line type="monotone" dataKey="rate" stroke="#4F6BED" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#4F6BED' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By event type */}
          <div style={card}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 16 }}>
              Attendance by Event Type
            </div>
            {loadingAtt ? <Skeleton h={180} /> : attByType.length === 0 ? <EmptyState message="No event type data" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={attByType} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="event_type" tickFormatter={fEventType} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={fEventType} />
                  <Bar dataKey="avg_rate" fill="#7B93F5" radius={[4, 4, 0, 0]} name="Avg Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
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
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEF3C7')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: '#111827' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#111827')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: '#6B7280' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, color: '#6B7280' }}>{m.group_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{fDate(m.last_seen)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: m.days_since > 60 ? '#EF4444' : '#F59E0B', background: m.days_since > 60 ? '#FEF2F2' : '#FFFBEB', padding: '2px 8px', borderRadius: 6 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Members" value={totalMembersCount.toLocaleString()} sub="Cumulative (12 months)" accent="#4F6BED" />
            <StatCard label="New This Month" value={newThisMonth} sub="Joined in current month" accent="#22C55E" />
            <StatCard label="Birthdays This Month" value={birthdays.length} sub="Active members" accent="#C8964A" />
          </div>

          {/* Growth chart */}
          <div style={card}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 20 }}>
              Membership Growth
            </div>
            {loadingMembers ? <Skeleton h={220} /> : memberGrowth.length === 0 ? <EmptyState message="No member growth data" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={memberGrowth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={36} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="new_members" fill="#E8ECF9" radius={[3, 3, 0, 0]} name="New Members" />
                  <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#4F6BED" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Cumulative" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gender donut + Age breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>
            {/* Gender */}
            <div style={card}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 16 }}>Gender Breakdown</div>
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
                            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>{g.gender}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#6B7280' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: '#F3F4F6' }}>
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
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 16 }}>Age Breakdown</div>
              {loadingMembers ? <Skeleton h={160} /> : ageBreakdown.length === 0 ? <EmptyState message="No age data available" /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={ageBreakdown} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="age_group" tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip />
                    <Bar dataKey="cnt" fill="#7B93F5" radius={[3, 3, 0, 0]} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
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
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EEF1FD')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: '#111827' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#111827')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: '#6B7280' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{fDate(m.created_at)}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 500, color: m.in_group ? '#15803D' : '#D97706', background: m.in_group ? '#DCFCE7' : '#FEF3C7', padding: '2px 8px', borderRadius: 6 }}>
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
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEF3C7')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB')}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={m.first_name} lastName={m.last_name} size={28} />
                            <div>
                              <div style={{ cursor: 'pointer', fontWeight: 500, color: '#111827' }}
                                onClick={() => navigate(`/members/${m.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#111827')}
                              >
                                {m.first_name} {m.last_name}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, color: '#6B7280' }}>{m.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total Groups" value={groups.length} sub="All groups" accent="#4F6BED" />
            <StatCard label="Active Groups" value={groups.filter(g => g.is_active).length} sub="Currently active" accent="#22C55E" />
            <StatCard label="Total Members in Groups" value={groups.reduce((s, g) => s + g.member_count, 0).toLocaleString()} sub="Across all groups" accent="#7B93F5" />
          </div>

          {/* Groups table */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>All Groups</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><SearchIcon /></div>
                  <input
                    type="text" placeholder="Search groups…" value={groupSearch}
                    onChange={e => setGroupSearch(e.target.value)}
                    style={{ height: 34, paddingLeft: 32, paddingRight: 12, borderRadius: 8, border: '0.5px solid #E5E7EB', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151', outline: 'none', width: 200, background: '#fff' }}
                  />
                </div>
                {filteredGroups.length > 0 && (
                  <button
                    onClick={() => setExportGroups(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: '#374151' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E5E7EB' }}
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
                      <tr key={g.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EEF1FD')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB')}
                      >
                        <td style={{ ...td, fontWeight: 500, color: '#111827' }}>{g.name}</td>
                        <td style={{ ...td, color: '#6B7280' }}>{g.ministry_name || '—'}</td>
                        <td style={{ ...td, color: '#6B7280' }}>{g.branch_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: '#374151' }}>{g.member_count}</td>
                        <td style={{ ...td, color: '#6B7280' }}>{g.leader_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 500, color: g.is_active ? '#15803D' : '#6B7280', background: g.is_active ? '#DCFCE7' : '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>
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
          columns={['Month', 'Tithe', 'Offering', 'Building', 'Other', 'Total']}
          rows={givingByCat.map(r => [
            monthLabel(r.month),
            fGHSFull(r.tithe), fGHSFull(r.offering),
            fGHSFull(r.building), fGHSFull(r.other_amount),
            fGHSFull(Number(r.tithe) + Number(r.offering) + Number(r.building) + Number(r.other_amount)),
          ])}
          filename={`giving-by-category-${givingPeriod.toLowerCase()}`}
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

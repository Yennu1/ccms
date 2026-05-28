import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, Bar, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }
interface MonthlyGiving { month: string; total: number }
interface MemberGrowth { month: string; new_members: number; cumulative: number }
interface WeeklyAtt { week_start: string; present_count: number; expected_count: number; rate: number }
interface CatBreakdown { category: string; total: number }
interface BranchComp { branch_id: string; branch_name: string; member_count: number; monthly_giving: number; attendance_rate: number }
interface AtRisk { id: string; first_name: string; last_name: string; member_number: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#C8964A', '#4F6BED', '#7B93F5', '#EC4899', '#9CA3AF']
const AP = [
  { bg: '#E8ECF9', color: '#4F6BED' }, { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' }, { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' }, { bg: '#FFF7ED', color: '#C2410C' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fGHS(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fGHSFull(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function greeting(name: string) {
  const h = new Date().getHours()
  return `Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}, ${name.split(' ')[0]}`
}
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7)
}
function computeEaster(yr: number) {
  const a = yr % 19, b = Math.floor(yr / 100), c = yr % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mo = Math.floor((h + l - 7 * m + 114) / 31)
  const dy = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(yr, mo - 1, dy)
}
function liturgicalSeason(date: Date) {
  const y = date.getFullYear(), t = date.getTime()
  const easter = computeEaster(y)
  const ashWed = new Date(easter.getTime() - 46 * 86400000)
  const pentecost = new Date(easter.getTime() + 49 * 86400000)
  const nov30 = new Date(y, 10, 30)
  const dow = nov30.getDay()
  const advent = new Date(y, 10, 30 - (dow <= 3 ? dow : dow - 7))
  const m = date.getMonth(), dy = date.getDate()
  if (m === 11 && dy >= 25) return 'Christmastide'
  if (m === 0 && dy <= 5) return 'Christmastide'
  if (t >= advent.getTime() && m === 11) return 'Advent'
  if (m === 0 && dy >= 6) return 'Epiphany Season'
  if (t < ashWed.getTime()) return 'Ordinary Time'
  if (t < easter.getTime()) return 'Lent'
  if (t < pentecost.getTime()) return 'Easter Season'
  if (t < pentecost.getTime() + 7 * 86400000) return 'Pentecost'
  if (t < advent.getTime()) return 'Ordinary Time'
  return 'Advent'
}
function avatarPalette(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AP[Math.abs(h) % AP.length]
}
function monthLabel(m: string) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' })
}
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }
function delta(curr: number, prev: number) {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}
function now() { return new Date() }

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Skeleton({ h = 160, r = 8 }: { h?: number; r?: number }) {
  return <div style={{ height: h, borderRadius: r, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

function KpiCard({ label, value, sub, delta: d, accent }: {
  label: string; value: string; sub?: string; delta?: number | null; accent: string
}) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minHeight: 20 }}>
        {d !== null && d !== undefined && (
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 600, color: d >= 0 ? '#22C55E' : '#EF4444', background: d >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', padding: '1px 6px', borderRadius: 999 }}>
            {d >= 0 ? '+' : ''}{d.toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF' }}>{sub}</span>}
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
    </div>
  )
}

function GivingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{monthLabel(label ?? '')}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#111827', fontWeight: 600 }}>{fGHSFull(payload[0]?.value ?? 0)}</div>
    </div>
  )
}

function AttTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Wk of {label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#111827', fontWeight: 600 }}>{payload[0]?.value ?? 0}%</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = now()

  // Branch
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>(() => localStorage.getItem('dash_branch') ?? '')

  // KPI
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [activeMembersLast, setActiveMembersLast] = useState(0)
  const [givingThisMonth, setGivingThisMonth] = useState(0)
  const [givingLastMonth, setGivingLastMonth] = useState(0)
  const [avgAttRate, setAvgAttRate] = useState<number | null>(null)
  const [eventsThisMonth, setEventsThisMonth] = useState(0)
  const [totalGroups, setTotalGroups] = useState(0)
  const [totalMinistries, setTotalMinistries] = useState(0)
  const [newThisMonth, setNewThisMonth] = useState(0)
  const [loadingKpi, setLoadingKpi] = useState(true)

  // Charts
  const [givingTrend, setGivingTrend] = useState<MonthlyGiving[]>([])
  const [givingPeriod, setGivingPeriod] = useState<'3M' | '6M' | '12M' | 'YTD'>('12M')
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowth[]>([])
  const [attTrend, setAttTrend] = useState<WeeklyAtt[]>([])
  const [catBreakdown, setCatBreakdown] = useState<CatBreakdown[]>([])
  const [branchComp, setBranchComp] = useState<BranchComp[]>([])
  const [loadingCharts, setLoadingCharts] = useState(true)

  // Quick reports
  const [atRiskMembers, setAtRiskMembers] = useState<AtRisk[]>([])
  const [atRiskCount, setAtRiskCount] = useState(0)
  const [newMemberCount, setNewMemberCount] = useState(0)
  const [newInGroupCount, setNewInGroupCount] = useState(0)
  const [birthdayCount, setBirthdayCount] = useState(0)
  const [birthdayThisWeek, setBirthdayThisWeek] = useState(0)
  const [topGiversTotal, setTopGiversTotal] = useState(0)
  const [loadingQuick, setLoadingQuick] = useState(true)

  // This Sunday
  const [sundayEvent, setSundayEvent] = useState<{ name: string; starts_at: string; expected_attendance: number | null } | null>(null)
  const [sundayAttendees, setSundayAttendees] = useState(0)

  const branchId = selectedBranch || null

  function handleBranchChange(v: string) {
    setSelectedBranch(v)
    localStorage.setItem('dash_branch', v)
  }

  // Fetch branches + lock pastor
  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
    if (user.role === 'pastor' && user.branch_id) setSelectedBranch(user.branch_id)
  }, [user?.org_id])

  // KPI stats
  useEffect(() => {
    if (!user?.org_id) return
    const orgId = user.org_id
    const bId = branchId
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const startLast = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
    const endLast = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
    const start28 = new Date(today.getTime() - 28 * 86400000).toISOString().split('T')[0]
    setLoadingKpi(true)

    const run = async () => {
      // Members
      const mBase = supabase.from('members').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
      const mActive = supabase.from('members').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('membership_status', 'active')
      const mNew = supabase.from('members').select('*', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', startOfMonth + 'T00:00:00')
      const mActiveLast = supabase.from('members').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('membership_status', 'active').lt('created_at', startLast + 'T00:00:00')

      const applyBranch = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        bId ? q.eq('branch_id', bId) : q

      const [r1, r2, r3, r4] = await Promise.all([
        applyBranch(mBase), applyBranch(mActive), applyBranch(mNew), applyBranch(mActiveLast),
      ])
      setTotalMembers(r1.count ?? 0)
      setActiveMembers(r2.count ?? 0)
      setNewThisMonth(r3.count ?? 0)
      setActiveMembersLast(r4.count ?? 0)

      // Giving
      const txBase = supabase.from('transactions').select('amount').eq('org_id', orgId)
      const txApply = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        bId ? q.eq('branch_id', bId) : q

      const [txThis, txLast] = await Promise.all([
        txApply(txBase.gte('transaction_date', startOfMonth) as unknown as typeof txBase),
        txApply((supabase.from('transactions').select('amount').eq('org_id', orgId).gte('transaction_date', startLast).lte('transaction_date', endLast)) as unknown as typeof txBase),
      ])
      const gThis = ((txThis.data ?? []) as { amount: number }[]).reduce((s, t) => s + Number(t.amount), 0)
      const gLast = ((txLast.data ?? []) as { amount: number }[]).reduce((s, t) => s + Number(t.amount), 0)
      setGivingThisMonth(gThis)
      setGivingLastMonth(gLast)

      // Events
      const evQ = supabase.from('events').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).gte('starts_at', startOfMonth + 'T00:00:00')
      const evRes = await (bId ? evQ.eq('branch_id', bId) : evQ)
      setEventsThisMonth(evRes.count ?? 0)

      // Groups + ministries
      const grQ = supabase.from('groups').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true)
      const grRes = await (bId ? grQ.eq('branch_id', bId) : grQ)
      setTotalGroups(grRes.count ?? 0)
      const { count: minCount } = await supabase.from('ministries').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true)
      setTotalMinistries(minCount ?? 0)

      // Avg attendance (last 4 sundays)
      const evAttQ = supabase.from('events').select('id, expected_attendance').eq('org_id', orgId)
        .eq('event_type', 'sunday_service').gte('starts_at', start28 + 'T00:00:00')
      const evAttRes = await (bId ? evAttQ.eq('branch_id', bId) : evAttQ)
      const evAttData = (evAttRes.data ?? []) as { id: string; expected_attendance: number | null }[]
      if (evAttData.length > 0) {
        const evIds = evAttData.map(e => e.id)
        const { count: attCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true })
          .eq('org_id', orgId).in('event_id', evIds)
        const totalExpected = evAttData.reduce((s, e) => s + (e.expected_attendance ?? 0), 0)
        setAvgAttRate(totalExpected > 0 ? Math.round(((attCount ?? 0) / totalExpected) * 100) : null)
      } else {
        setAvgAttRate(null)
      }

      setLoadingKpi(false)
    }
    run().catch(() => setLoadingKpi(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.org_id, selectedBranch])

  // Charts
  useEffect(() => {
    if (!user?.org_id) return
    const orgId = user.org_id
    const bId = branchId
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    setLoadingCharts(true)

    const run = async () => {
      const [giv, mg, att, cat, bc] = await Promise.all([
        supabase.rpc('get_monthly_giving', { p_org_id: orgId, p_branch_id: bId, p_months: 12 }),
        supabase.rpc('get_monthly_member_growth', { p_org_id: orgId, p_branch_id: bId, p_months: 12 }),
        supabase.rpc('get_weekly_attendance', { p_org_id: orgId, p_branch_id: bId, p_weeks: 12 }),
        supabase.rpc('get_category_breakdown', { p_org_id: orgId, p_branch_id: bId, p_start: startOfMonth, p_end: endOfMonth }),
        !bId ? supabase.rpc('get_branch_comparison', { p_org_id: orgId, p_start: startOfMonth, p_end: endOfMonth }) : Promise.resolve({ data: [] }),
      ])
      setGivingTrend((giv.data ?? []) as MonthlyGiving[])
      setMemberGrowth((mg.data ?? []) as MemberGrowth[])
      setAttTrend((att.data ?? []) as WeeklyAtt[])
      setCatBreakdown((cat.data ?? []) as CatBreakdown[])
      setBranchComp((bc.data ?? []) as BranchComp[])
      setLoadingCharts(false)
    }
    run().catch(() => setLoadingCharts(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.org_id, selectedBranch])

  // Quick reports
  useEffect(() => {
    if (!user?.org_id) return
    const orgId = user.org_id
    const bId = branchId
    const todayStr = today.toISOString().split('T')[0]
    const startOfMo = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const startTopQ = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    setLoadingQuick(true)

    const run = async () => {
      // Members at risk
      const atRisk = await supabase.rpc('get_members_at_risk', { p_org_id: orgId, p_branch_id: bId, p_days: 30, p_limit: 5 })
      const atRiskFull = await supabase.rpc('get_members_at_risk', { p_org_id: orgId, p_branch_id: bId, p_days: 30, p_limit: 200 })
      const uniqueAtRisk = Array.from(new Map(((atRisk.data ?? []) as AtRisk[]).map(m => [m.id, m])).values())
      const uniqueAtRiskFull = Array.from(new Map(((atRiskFull.data ?? []) as AtRisk[]).map(m => [m.id, m])).values())
      setAtRiskMembers(uniqueAtRisk.slice(0, 5))
      setAtRiskCount(uniqueAtRiskFull.length)

      // New members
      const newMQ = supabase.from('members').select('id, group_memberships!inner(id)', { count: 'exact', head: false })
        .eq('org_id', orgId).gte('created_at', startOfMo + 'T00:00:00')
      const newMAll = supabase.from('members').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).gte('created_at', startOfMo + 'T00:00:00')
      const [nmAll, nmGroup] = await Promise.all([
        bId ? newMAll.eq('branch_id', bId) : newMAll,
        bId ? newMQ.eq('branch_id', bId) : newMQ,
      ])
      setNewMemberCount(nmAll.count ?? 0)
      setNewInGroupCount((nmGroup.data ?? []).length)

      // Birthdays
      const curMonth = today.getMonth() + 1
      const allMembersQ = supabase.from('members').select('date_of_birth').eq('org_id', orgId).not('date_of_birth', 'is', null)
      const allM = await (bId ? allMembersQ.eq('branch_id', bId) : allMembersQ)
      const memberDobs = (allM.data ?? []) as { date_of_birth: string }[]
      const bdays = memberDobs.filter(m => {
        if (!m.date_of_birth) return false
        const d = new Date(m.date_of_birth)
        return d.getMonth() + 1 === curMonth
      })
      setBirthdayCount(bdays.length)
      const thisWeekBdays = memberDobs.filter(m => {
        if (!m.date_of_birth) return false
        const dob = new Date(m.date_of_birth)
        const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
        return thisYearBday >= today && thisYearBday <= new Date(today.getTime() + 7 * 86400000)
      })
      setBirthdayThisWeek(thisWeekBdays.length)

      // Top givers
      const topG = await supabase.rpc('get_top_givers', {
        p_org_id: orgId, p_branch_id: bId, p_start: startTopQ, p_end: todayStr, p_limit: 25,
      })
      const topData = (topG.data ?? []) as { total_given: number }[]
      setTopGiversTotal(topData.reduce((s, g) => s + Number(g.total_given), 0))

      // This Sunday
      const nextSunQ = supabase.from('events').select('id, name, starts_at, expected_attendance')
        .eq('org_id', orgId).eq('event_type', 'sunday_service')
        .gte('starts_at', todayStr + 'T00:00:00').order('starts_at').limit(1)
      const sundayRes = await (bId ? nextSunQ.eq('branch_id', bId) : nextSunQ)
      const sunData = (sundayRes.data ?? [])[0] as { id: string; name: string; starts_at: string; expected_attendance: number | null } | undefined
      if (sunData) {
        setSundayEvent(sunData)
        const { count: attCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('event_id', sunData.id)
        setSundayAttendees(attCount ?? 0)
      }

      setLoadingQuick(false)
    }
    run().catch(() => setLoadingQuick(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.org_id, selectedBranch])

  // Filtered giving trend by period
  const filteredGiving = (() => {
    if (givingPeriod === 'YTD') {
      const yr = today.getFullYear().toString()
      return givingTrend.filter(d => d.month.startsWith(yr))
    }
    const months = givingPeriod === '3M' ? 3 : givingPeriod === '6M' ? 6 : 12
    return givingTrend.slice(-months)
  })()

  const givingTotal12 = givingTrend.reduce((s, d) => s + Number(d.total), 0)

  // Donut data
  const donutTotal = catBreakdown.reduce((s, c) => s + Number(c.total), 0)

  // Branch comparison max values
  const maxMembers = Math.max(...branchComp.map(b => b.member_count), 1)
  const maxGiving = Math.max(...branchComp.map(b => Number(b.monthly_giving)), 1)

  const activePct = totalMembers > 0 ? pct(activeMembers, totalMembers) : 0
  const activePctLast = activeMembersLast > 0 ? pct(activeMembersLast, totalMembers) : 0
  const givingDelta = delta(givingThisMonth, givingLastMonth)
  const activeDelta = delta(activePct, activePctLast)
  const season = liturgicalSeason(today)
  const weekNum = isoWeek(today)

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .dash-select:focus { border-color: #4F6BED !important; outline: none; }
        .period-btn:hover { background: #F9FAFB !important; }
        .qr-card:hover { border-color: #D1D5DB !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: '#111827', letterSpacing: '-0.015em', margin: '0 0 3px' }}>
            {greeting(user?.full_name ?? 'there')}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#9CA3AF' }}>
              {today.toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D5DB' }} />
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>
              Week {weekNum} · {season}
            </span>
          </div>
        </div>

        {/* Branch filter */}
        {user?.role !== 'pastor' && (
          <select
            className="dash-select"
            value={selectedBranch}
            onChange={e => handleBranchChange(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151', background: '#fff', padding: '0 12px', cursor: 'pointer' }}
          >
            <option value="">All Branches (Org-Wide)</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        {loadingKpi ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={100} />)
        ) : (
          <>
            <KpiCard label="Total Members" value={totalMembers.toLocaleString()} sub={`+${newThisMonth} this month`} delta={null} accent="#4F6BED" />
            <KpiCard label="Active Members" value={`${activePct}%`} sub={`${activeMembers.toLocaleString()} active`} delta={activeDelta} accent="#7B93F5" />
            <KpiCard label="Giving This Month" value={fGHS(givingThisMonth)} sub={`Last month: ${fGHS(givingLastMonth)}`} delta={givingDelta} accent="#C8964A" />
            <KpiCard label="Avg Attendance Rate" value={avgAttRate !== null ? `${avgAttRate}%` : '—'} sub="Last 4 Sundays" delta={null} accent="#22C55E" />
            <KpiCard label="Events This Month" value={eventsThisMonth.toLocaleString()} sub="Scheduled &amp; completed" delta={null} accent="#EC4899" />
            <KpiCard label="Groups &amp; Ministries" value={`${totalGroups} / ${totalMinistries}`} sub={`${totalGroups} groups · ${totalMinistries} ministries`} delta={null} accent="#8B5CF6" />
          </>
        )}
      </div>

      {/* ── Charts Row 1: Giving Trend + Donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Giving Trend */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>Giving Trend</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{fGHSFull(givingTotal12)} · 12-month total</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['3M', '6M', '12M', 'YTD'] as const).map(p => (
                <button key={p} className="period-btn" onClick={() => setGivingPeriod(p)} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: `1px solid ${givingPeriod === p ? '#4F6BED' : '#E5E7EB'}`, background: givingPeriod === p ? '#EEF1FD' : '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11.5, color: givingPeriod === p ? '#4F6BED' : '#6B7280', cursor: 'pointer' }}>{p}</button>
              ))}
            </div>
          </div>
          {loadingCharts ? <Skeleton h={180} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={filteredGiving} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `₵${(v / 1000).toFixed(0)}k`} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<GivingTooltip />} />
                <Line type="monotone" dataKey="total" stroke="#4F6BED" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#4F6BED' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 14 }}>Giving Breakdown</div>
          {loadingCharts || catBreakdown.length === 0 ? <Skeleton h={180} /> : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={60} dataKey="total" paddingAngle={2}>
                      {catBreakdown.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fGHSFull(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: '#111827' }}>{fGHS(donutTotal)}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10, color: '#9CA3AF' }}>total</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {catBreakdown.slice(0, 4).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280' }}>{donutTotal > 0 ? pct(Number(c.total), donutTotal) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Member Growth + Attendance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Membership Growth */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 14 }}>Membership Growth</div>
          {loadingCharts ? <Skeleton h={180} /> : memberGrowth.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={memberGrowth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={30} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={34} />
                <Tooltip labelFormatter={monthLabel} />
                <Bar yAxisId="left" dataKey="new_members" fill="#E8ECF9" name="New" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#4F6BED" strokeWidth={2} dot={false} name="Total" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance Trend */}
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 14 }}>Attendance Trend <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: '#9CA3AF' }}>Sunday services · last 12 wks</span></div>
          {loadingCharts ? <Skeleton h={180} /> : attTrend.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No Sunday service data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={attTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#F3F4F6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week_start" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={38} />
                <Tooltip content={<AttTooltip />} />
                <ReferenceArea y1={75} y2={85} fill="#22C55E" fillOpacity={0.07} />
                <Line type="monotone" dataKey="rate" stroke="#22C55E" strokeWidth={2} dot={{ r: 3, fill: '#22C55E' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Branch Comparison (org-wide only) ── */}
      {!selectedBranch && (
        <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 14 }}>Branch Comparison</div>
          {loadingCharts ? <Skeleton h={80} /> : branchComp.length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>No branch data</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                {['Branch', 'Members', 'Giving (this month)', 'Attendance %'].map(h => (
                  <div key={h} style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {branchComp.map(b => (
                <div key={b.branch_id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '0.5px solid #F3F4F6' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.branch_name}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F3F4F6' }}>
                        <div style={{ height: 6, borderRadius: 3, background: '#4F6BED', width: `${pct(b.member_count, maxMembers)}%` }} />
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280', minWidth: 28, textAlign: 'right' }}>{b.member_count}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F3F4F6' }}>
                        <div style={{ height: 6, borderRadius: 3, background: '#C8964A', width: `${pct(Number(b.monthly_giving), maxGiving)}%` }} />
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280', minWidth: 50, textAlign: 'right' }}>{fGHS(Number(b.monthly_giving))}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F3F4F6' }}>
                        <div style={{ height: 6, borderRadius: 3, background: '#22C55E', width: `${Math.min(Number(b.attendance_rate), 100)}%` }} />
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280', minWidth: 36, textAlign: 'right' }}>{b.attendance_rate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Reports ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>

        {/* Members at Risk */}
        <div className="qr-card" onClick={() => navigate('/reports?tab=attendance')} style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>Members at Risk</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>No attendance in 30 days</div>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: '#EF4444' }}>{loadingQuick ? '—' : atRiskCount}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {atRiskMembers.map((m, i) => {
              const { bg, color } = avatarPalette(m.first_name + m.last_name)
              return (
                <div key={`${m.id}-${i}`} title={`${m.first_name} ${m.last_name}`} style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                  {m.first_name[0]}{m.last_name[0]}
                </div>
              )
            })}
            {atRiskCount > 5 && <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>+{atRiskCount - 5}</div>}
          </div>
        </div>

        {/* New Member Follow-up */}
        <div className="qr-card" onClick={() => navigate('/reports?tab=members')} style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>New Member Follow-up</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Joined in last 30 days</div>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: '#4F6BED' }}>{loadingQuick ? '—' : newMemberCount}</div>
          </div>
          {!loadingQuick && newMemberCount > 0 && (
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280' }}>
              <span style={{ color: '#22C55E', fontWeight: 600 }}>{newInGroupCount}</span> assigned to a group · <span style={{ color: '#EF4444', fontWeight: 600 }}>{newMemberCount - newInGroupCount}</span> unassigned
            </div>
          )}
        </div>

        {/* Birthdays */}
        <div className="qr-card" onClick={() => navigate('/reports?tab=members')} style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>Birthdays This Month</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>
                {today.toLocaleDateString('en', { month: 'long' })}
              </div>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: '#C8964A' }}>{loadingQuick ? '—' : birthdayCount}</div>
          </div>
          {!loadingQuick && birthdayCount > 0 && (
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280' }}>
              <span style={{ color: '#4F6BED', fontWeight: 600 }}>{birthdayThisWeek}</span> celebrating this week
            </div>
          )}
        </div>

        {/* Top Givers */}
        <div className="qr-card" onClick={() => navigate('/reports?tab=giving')} style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>Top Givers This Month</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Top 25 by giving</div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 18, color: '#22C55E' }}>{loadingQuick ? '—' : fGHS(topGiversTotal)}</div>
          </div>
          {!loadingQuick && sundayEvent && (
            <div style={{ marginTop: 4, padding: '8px 10px', background: '#F9FAFB', borderRadius: 6 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Next Sunday: {sundayEvent.name}</div>
              {sundayEvent.expected_attendance && (
                <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB' }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#4F6BED', width: `${Math.min(pct(sundayAttendees, sundayEvent.expected_attendance), 100)}%` }} />
                </div>
              )}
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                {sundayAttendees} / {sundayEvent.expected_attendance ?? '?'} expected
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

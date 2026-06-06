import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MemberAvatar as SharedMemberAvatar } from '../../components/MemberAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

type DetailTab = 'attendance' | 'donations' | 'qr'

interface EventRow {
  id: string
  org_id: string
  branch_id: string | null
  name: string
  event_type: string | null
  status: string | null
  starts_at: string
  ends_at: string | null
  expected_attendance: number | null
  speaker: string | null
  location: string | null
  description: string | null
  recurrence_rule: unknown
  parent_event_id: string | null
  occurrence_number: number | null
  branches: { id: string; name: string } | null
}

interface ParentEvent { id: string; name: string }

interface RosterMember {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
  photo_url: string | null
}

interface AttendanceRecord {
  id: string
  member_id: string
  present: boolean
}

interface TxRow {
  id: string
  member_id: string | null
  amount: number
  payment_method: string
  transaction_date: string
  reference_number: string | null
  is_collective: boolean
  transaction_categories: { id: string; name: string } | null
  member: { first_name: string; last_name: string; member_number: string | null } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  sunday_service:          { bg: 'var(--etype-sunday-bg)',     color: 'var(--etype-sunday-fg)',     dot: 'var(--etype-sunday-dot)',     label: 'Sunday Service' },
  midweek_service:         { bg: 'var(--etype-midweek-bg)',    color: 'var(--etype-midweek-fg)',    dot: 'var(--etype-midweek-dot)',    label: 'Midweek Service' },
  prayer_meeting:          { bg: 'var(--etype-prayer-bg)',     color: 'var(--etype-prayer-fg)',     dot: 'var(--etype-prayer-dot)',     label: 'Prayer Meeting' },
  youth_service:           { bg: 'var(--etype-youth-bg)',      color: 'var(--etype-youth-fg)',      dot: 'var(--etype-youth-dot)',      label: 'Youth Service' },
  special_programme:       { bg: 'var(--etype-special-bg)',    color: 'var(--etype-special-fg)',    dot: 'var(--etype-special-dot)',    label: 'Special Programme' },
  outreach:                { bg: 'var(--etype-outreach-bg)',   color: 'var(--etype-outreach-fg)',   dot: 'var(--etype-outreach-dot)',   label: 'Outreach' },
  conference:              { bg: 'var(--etype-conference-bg)', color: 'var(--etype-conference-fg)', dot: 'var(--etype-conference-dot)', label: 'Conference' },
  funeral_burial_service:  { bg: 'var(--etype-funeral-bg)',    color: 'var(--etype-funeral-fg)',    dot: 'var(--etype-funeral-dot)',    label: 'Funeral/Burial' },
  custom:                  { bg: 'var(--etype-custom-bg)',     color: 'var(--etype-custom-fg)',     dot: 'var(--etype-custom-dot)',     label: 'Custom' },
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  tithe:        { bg: 'var(--cat-tithe-bg)',        color: 'var(--cat-tithe-fg)',        dot: 'var(--cat-tithe-dot)' },
  offering:     { bg: 'var(--cat-offering-bg)',     color: 'var(--cat-offering-fg)',     dot: 'var(--cat-offering-dot)' },
  building:     { bg: 'var(--cat-building-bg)',     color: 'var(--cat-building-fg)',     dot: 'var(--cat-building-dot)' },
  welfare:      { bg: 'var(--cat-welfare-bg)',      color: 'var(--cat-welfare-fg)',      dot: 'var(--cat-welfare-dot)' },
  thanksgiving: { bg: 'var(--cat-thanksgiving-bg)', color: 'var(--cat-thanksgiving-fg)', dot: 'var(--cat-thanksgiving-dot)' },
  special:      { bg: 'var(--cat-special-bg)',      color: 'var(--cat-special-fg)',      dot: 'var(--cat-special-dot)' },
}

const AVATAR_PALETTE = [
  { bg: 'var(--avatar-1-bg)', color: 'var(--avatar-1-fg)' },
  { bg: 'var(--avatar-2-bg)', color: 'var(--avatar-2-fg)' },
  { bg: 'var(--avatar-3-bg)', color: 'var(--avatar-3-fg)' },
  { bg: 'var(--avatar-4-bg)', color: 'var(--avatar-4-fg)' },
  { bg: 'var(--avatar-5-bg)', color: 'var(--avatar-5-fg)' },
  { bg: 'var(--avatar-6-bg)', color: 'var(--avatar-6-fg)' },
  { bg: 'var(--avatar-7-bg)', color: 'var(--avatar-7-fg)' },
  { bg: 'var(--avatar-8-bg)', color: 'var(--avatar-8-fg)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(first: string, last: string) {
  let hash = 0
  for (const c of (first + last).toLowerCase()) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function getEventTypeStyle(type: string | null) {
  return EVENT_TYPE_STYLES[type ?? ''] ?? { bg: 'var(--etype-funeral-bg)', color: 'var(--etype-funeral-fg)', dot: 'var(--etype-funeral-dot)', label: type ?? 'Event' }
}

function getCatStyle(name: string) {
  const l = (name ?? '').toLowerCase()
  if (l === 'tithe') return CATEGORY_STYLES.tithe
  if (l === 'offering') return CATEGORY_STYLES.offering
  if (l.includes('building')) return CATEGORY_STYLES.building
  if (l === 'welfare') return CATEGORY_STYLES.welfare
  if (l === 'thanksgiving') return CATEGORY_STYLES.thanksgiving
  if (l.includes('special')) return CATEGORY_STYLES.special
  return CATEGORY_STYLES.offering
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTs(iso: string) {
  try { return new Date(iso).toLocaleString('en-GH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none">{dir === 'left' ? <path d="M9 11 5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}</svg>
}
function ArrowRightIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CollectiveAvatar({ size = 28 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--cat-welfare-bg)', color: 'var(--cat-welfare-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

function MemberAvatar({ first, last, size = 32 }: { first: string; last: string; size?: number }) {
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
  const { bg, color } = getAvatarColor(first, last)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: size < 36 ? 11 : 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden', flex: 1 }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dm-text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--dm-text-ink)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
    </div>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ event, orgId }: { event: EventRow; orgId: string }) {
  const [members, setMembers] = useState<RosterMember[]>([])
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [initialPresentIds, setInitialPresentIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all')
  const [page, setPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const PAGE = 20

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const branchId = event.branch_id

      const [membersRes, attRes] = await Promise.all([
        branchId
          ? supabase.from('members').select('id, first_name, last_name, member_number, photo_url').eq('org_id', orgId).eq('branch_id', branchId).eq('membership_status', 'active').order('first_name')
          : supabase.from('members').select('id, first_name, last_name, member_number, photo_url').eq('org_id', orgId).eq('membership_status', 'active').order('first_name'),
        supabase.from('attendance').select('id, member_id, present').eq('event_id', event.id),
      ])

      setMembers((membersRes.data ?? []) as RosterMember[])

      const existingPresent = new Set(
        ((attRes.data ?? []) as AttendanceRecord[])
          .filter(r => r.present)
          .map(r => r.member_id)
      )
      setPresentIds(existingPresent)
      setInitialPresentIds(existingPresent)
      setLoading(false)
    }
    fetchData()
  }, [event.id, event.branch_id, orgId])

  const toggle = (memberId: string) => {
    setPresentIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const markAll = () => setPresentIds(new Set(members.map(m => m.id)))
  const clearAll = () => setPresentIds(new Set())

  const handleSave = async () => {
    setSaving(true)
    const records = members.map(m => ({
      event_id: event.id,
      member_id: m.id,
      org_id: orgId,
      present: presentIds.has(m.id),
    }))
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'event_id,member_id' })
    if (error) {
      toast.error('Failed to save attendance')
    } else {
      setLastSaved(new Date())
      setInitialPresentIds(new Set(presentIds))
      toast.success('Attendance saved')
    }
    setSaving(false)
  }

  const exportCSV = () => {
    const rows = members.map(m => [
      `${m.first_name} ${m.last_name}`,
      m.member_number ?? '—',
      presentIds.has(m.id) ? 'Present' : 'Absent',
    ])
    const csv = [['Name', 'Member No', 'Status'], ...rows]
      .map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.name.replace(/\s+/g, '-')}-attendance.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const exportExcel = () => {
    const rows = members.map(m => [
      `${m.first_name} ${m.last_name}`,
      m.member_number ?? '—',
      presentIds.has(m.id) ? 'Present' : 'Absent',
    ])
    const ws = XLSX.utils.aoa_to_sheet([['Name', 'Member No', 'Status'], ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '-')}-attendance.xlsx`)
    setExportOpen(false)
  }

  const presentCount = presentIds.size
  const expectedCount = event.expected_attendance ?? members.length
  const rate = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || (m.member_number ?? '').toLowerCase().includes(q)
    const matchFilter = filter === 'all' || (filter === 'present' && presentIds.has(m.id)) || (filter === 'absent' && !presentIds.has(m.id))
    return matchSearch && matchFilter
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE)

  useEffect(() => { setPage(1) }, [search, filter])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasChanges = (() => {
    if (presentIds.size !== initialPresentIds.size) return true
    for (const id of presentIds) { if (!initialPresentIds.has(id)) return true }
    return false
  })()

  const inputStyle: React.CSSProperties = { height: 34, borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none', padding: '0 10px' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>Loading roster…</div>

  return (
    <div>
      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <StatCard label="Expected" value={event.expected_attendance ?? '—'} accent="#4F6BED" />
        <StatCard label="Present" value={presentCount} accent="#22C55E" />
        <StatCard label="Attendance Rate" value={`${rate}%`} accent="#C8964A" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 200px' }}>
          <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' }}><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'present', 'absent'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ height: 34, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: filter === f ? '#4F6BED' : 'var(--dm-bg-card)', color: filter === f ? '#fff' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>

        <button onClick={markAll} style={{ height: 34, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>
          Mark All Present
        </button>
        <button onClick={clearAll} style={{ height: 34, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>
          Clear All
        </button>

        <div style={{ flex: 1 }} />

        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setExportOpen(o => !o)}
            style={{ height: 34, padding: '0 12px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Export
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 50, minWidth: 190, overflow: 'hidden' }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Export as CSV</button>
              <button onClick={exportExcel} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Export as Excel (.xlsx)</button>
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{ height: 34, padding: '0 14px', borderRadius: 7, border: 'none', background: saving || !hasChanges ? '#818CF8' : '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 12.5, cursor: saving || !hasChanges ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save Attendance'}
        </button>
      </div>

      {/* Roster */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 10, overflow: 'hidden' }}>
        {paginated.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
            No members match your filters
          </div>
        ) : paginated.map((m, i) => {
          const present = presentIds.has(m.id)
          return (
            <div
              key={m.id}
              onClick={() => toggle(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                borderBottom: i < paginated.length - 1 ? '0.5px solid var(--dm-border-subtle)' : 'none',
                background: present ? 'rgba(34,197,94,0.08)' : 'var(--dm-bg-card)',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!present) e.currentTarget.style.background = 'var(--dm-bg-surface)' }}
              onMouseLeave={e => { e.currentTarget.style.background = present ? 'rgba(34,197,94,0.08)' : 'var(--dm-bg-card)' }}
            >
              <SharedMemberAvatar firstName={m.first_name} lastName={m.last_name} photoUrl={m.photo_url} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-ink)' }}>
                  {m.first_name} {m.last_name}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
                  {m.member_number ?? '—'}
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999,
                background: present ? 'var(--badge-active-bg)' : 'var(--badge-inactive-bg)',
                color: present ? 'var(--badge-active-fg)' : 'var(--badge-inactive-fg)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 11.5,
              }}>
                {present ? '✓ Present' : 'Absent'}
              </span>
              <div style={{
                width: 20, height: 20, borderRadius: 4,
                border: present ? '1.5px solid #22C55E' : '1.5px solid var(--dm-border-strong)',
                background: present ? '#22C55E' : 'var(--dm-bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {present && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination + last saved */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronIcon dir="left" /> Prev
          </button>
          <span style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            Next <ChevronIcon dir="right" />
          </button>
        </div>
        {lastSaved && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
            Last saved: {formatTs(lastSaved.toISOString())}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Donations Tab ────────────────────────────────────────────────────────────

function DonationsTab({ eventId }: { eventId: string }) {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('transactions')
      .select(`id, member_id, amount, payment_method, transaction_date, reference_number, is_collective, transaction_categories(id, name), member:members!transactions_member_id_fkey(first_name, last_name, member_number)`)
      .eq('event_id', eventId)
      .order('transaction_date', { ascending: false })
      .then(({ data }) => { setTransactions((data ?? []) as unknown as TxRow[]); setLoading(false) })
  }, [eventId])

  const total = transactions.reduce((s, t) => s + t.amount, 0)

  const th: React.CSSProperties = { padding: '10px 16px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '0.5px solid var(--dm-border-subtle)', background: 'var(--dm-bg-surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 10, padding: '12px 18px' }}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dm-text-secondary)', marginBottom: 2 }}>Total Collected</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 22, color: 'var(--dm-text-ink)' }}>{loading ? '—' : formatAmount(total)}</div>
        </div>
        <button
          onClick={() => navigate(`/donations/new?event_id=${eventId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          Record Giving
        </button>
      </div>

      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Member</th>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Method</th>
              <th style={th}>Date</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '30px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>Loading…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>No giving records for this event yet.</div>
              </td></tr>
            ) : transactions.map(tx => {
              const isCol = tx.is_collective === true
              const firstName = tx.member?.first_name ?? 'Anonymous'
              const lastName = tx.member?.last_name ?? ''
              const catName = tx.transaction_categories?.name ?? ''
              const catS = getCatStyle(catName)
              return (
                <tr key={tx.id} onClick={() => navigate(`/donations/${tx.id}`)} style={{ borderBottom: '0.5px solid var(--dm-border-subtle)', height: 52, background: 'var(--dm-bg-card)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>
                  <td style={{ padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {isCol ? <CollectiveAvatar size={28} /> : <MemberAvatar first={firstName} last={lastName || 'A'} size={28} />}
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)' }}>
                          {isCol ? 'Collective Offering' : tx.member ? `${firstName} ${lastName}` : 'Anonymous'}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--dm-text-muted)' }}>
                          {isCol ? '—' : tx.member?.member_number ?? '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    {isCol ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'var(--cat-tithe-bg)', color: 'var(--cat-tithe-fg)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8964A' }} />
                        Collective
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: catS.bg, color: catS.color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: catS.dot }} />
                        {catName || '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0 16px', textAlign: 'right' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: 'var(--dm-text-ink)', fontWeight: 600 }}>{formatAmount(tx.amount)}</span>
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: 'var(--dm-text-body)' }}>{tx.payment_method}</span>
                  </td>
                  <td style={{ padding: '0 16px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: 'var(--dm-text-secondary)' }}>{tx.transaction_date}</span>
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    <button onClick={e => { e.stopPropagation(); navigate(`/donations/${tx.id}`) }} style={{ width: 26, height: 26, borderRadius: 5, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}>
                      <ArrowRightIcon />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── QR Tab ───────────────────────────────────────────────────────────────────

function QRTab({ eventId }: { eventId: string }) {
  const checkInUrl = `${window.location.origin}/checkin/${eventId}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 20 }}>
      <div style={{ width: 180, height: 180, borderRadius: 12, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative' }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity="0.2">
          <rect x="4" y="4" width="30" height="30" rx="3" stroke="#6B7280" strokeWidth="3" />
          <rect x="10" y="10" width="18" height="18" rx="1" fill="#6B7280" />
          <rect x="46" y="4" width="30" height="30" rx="3" stroke="#6B7280" strokeWidth="3" />
          <rect x="52" y="10" width="18" height="18" rx="1" fill="#6B7280" />
          <rect x="4" y="46" width="30" height="30" rx="3" stroke="#6B7280" strokeWidth="3" />
          <rect x="10" y="52" width="18" height="18" rx="1" fill="#6B7280" />
          <rect x="46" y="46" width="8" height="8" rx="1" fill="#6B7280" opacity="0.5" />
          <rect x="58" y="46" width="8" height="8" rx="1" fill="#6B7280" opacity="0.5" />
          <rect x="46" y="58" width="8" height="8" rx="1" fill="#6B7280" opacity="0.5" />
          <rect x="58" y="58" width="8" height="8" rx="1" fill="#6B7280" opacity="0.5" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="18" fill="var(--dm-bg-muted)" />
            <path d="M18 10v8M14 14l4-4 4 4M12 24h12" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 6 }}>
          QR Check-in
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)', marginBottom: 4 }}>
          QR check-in coming in Sprint 7
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#D1D5DB' }}>
          {checkInUrl}
        </div>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(checkInUrl); toast.success('Check-in link copied!') }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
      >
        Copy Check-in Link
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventRow | null>(null)
  const [parentEvent, setParentEvent] = useState<ParentEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('attendance')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Print sheet data
  const [orgName, setOrgName] = useState('Centry Church')
  const [printMembers, setPrintMembers] = useState<RosterMember[]>([])
  const [printPresentIds, setPrintPresentIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!id) return
    supabase.from('events').select('*, branches(id, name)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else {
          setEvent(data as EventRow)
          if ((data as EventRow).parent_event_id) {
            supabase.from('events').select('id, name').eq('id', (data as EventRow).parent_event_id!).single()
              .then(({ data: pd }) => { if (pd) setParentEvent(pd as ParentEvent) })
          }
        }
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!event || !user) return
    supabase.from('organisations').select('name').eq('id', user.org_id).maybeSingle()
      .then(({ data }) => { if (data?.name) setOrgName(data.name) })
    const mq = event.branch_id
      ? supabase.from('members').select('id, first_name, last_name, member_number, photo_url').eq('org_id', user.org_id).eq('branch_id', event.branch_id).eq('membership_status', 'active').order('first_name')
      : supabase.from('members').select('id, first_name, last_name, member_number, photo_url').eq('org_id', user.org_id).eq('membership_status', 'active').order('first_name')
    Promise.all([mq, supabase.from('attendance').select('id, member_id, present').eq('event_id', event.id)])
      .then(([mr, ar]) => {
        setPrintMembers((mr.data ?? []) as RosterMember[])
        setPrintPresentIds(new Set(((ar.data ?? []) as AttendanceRecord[]).filter(r => r.present).map(r => r.member_id)))
      })
  }, [event?.id, user?.org_id])

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    await supabase.from('attendance').delete().eq('event_id', event.id)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) { toast.error('Failed to delete event'); setDeleting(false) }
    else { toast.success('Event deleted'); navigate('/events') }
  }

  const typeStyle = getEventTypeStyle(event?.event_type ?? null)

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'attendance', label: 'Attendance' },
    { key: 'donations', label: 'Donations' },
    { key: 'qr', label: 'QR Check-in' },
  ]

  // Print sheet stats (computed from database-fetched data, not AttendanceTab state)
  const printExpected = event?.expected_attendance ?? printMembers.length
  const printRate = printExpected > 0 ? Math.round((printPresentIds.size / printExpected) * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
      Loading event…
    </div>
  )

  if (notFound || !event) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 8 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--dm-text-ink)' }}>Event not found</div>
      <button onClick={() => navigate('/events')} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#4F6BED' }}>Back to Events</button>
    </div>
  )

  return (
    <>
      {/* ── Print sheet (hidden on screen, shown on print) ────────────────── */}
      <div id="ccms-print-sheet">
        <style>{`
          #ccms-print-sheet { font-family: Georgia, 'Times New Roman', serif; color: #000; }
          #ccms-print-sheet .ps-table { width: 100%; border-collapse: collapse; font-size: 10pt; font-family: Arial, sans-serif; }
          #ccms-print-sheet .ps-table thead th { background: #000; color: #fff; text-align: left; padding: 6px 10px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
          #ccms-print-sheet .ps-table thead th:first-child { width: 36px; }
          #ccms-print-sheet .ps-table thead th:last-child { width: 72px; }
          #ccms-print-sheet .ps-table tbody td { padding: 5px 10px; border-bottom: 0.5pt solid #ddd; font-size: 10pt; }
          #ccms-print-sheet .ps-table tbody tr:nth-child(even) td { background: #f4f4f4; }
        `}</style>

        {/* Page header */}
        <div style={{ borderBottom: '2.5pt solid #000', paddingBottom: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{orgName}</div>
            <div style={{ fontSize: '9pt', fontFamily: 'Arial, sans-serif', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Attendance Register</div>
          </div>
          <div style={{ borderTop: '0.5pt solid #ccc', marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: '18pt', fontWeight: 'bold', marginBottom: 5, lineHeight: 1.2 }}>{event.name}</div>
            <div style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif', color: '#333', marginBottom: 3 }}>
              {typeStyle.label}
              {event.branches?.name ? ` · ${event.branches.name}` : ''}
              {event.status ? ` · ${event.status.charAt(0).toUpperCase()}${event.status.slice(1)}` : ''}
            </div>
            <div style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif', color: '#333', marginBottom: 3 }}>
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
              {event.location ? ` · ${event.location}` : ''}
            </div>
            {event.speaker && (
              <div style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif', color: '#333' }}>
                Speaker / Leader: {event.speaker}
              </div>
            )}
          </div>
        </div>

        {/* Summary row */}
        <div style={{ display: 'flex', gap: 40, fontSize: '10pt', fontFamily: 'Arial, sans-serif', padding: '8px 0', borderBottom: '1pt solid #000', marginBottom: 14 }}>
          <span><strong>Expected:</strong> {event.expected_attendance ?? '—'}</span>
          <span><strong>Present:</strong> {printPresentIds.size}</span>
          <span><strong>Absent:</strong> {printMembers.length - printPresentIds.size}</span>
          <span><strong>Attendance Rate:</strong> {printRate}%</span>
        </div>

        {/* Attendance table */}
        <table className="ps-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Member Name</th>
              <th>Member Number</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {printMembers.map((m, i) => (
              <tr key={m.id}>
                <td>{i + 1}</td>
                <td>{m.first_name} {m.last_name}</td>
                <td>{m.member_number ?? '—'}</td>
                <td>{printPresentIds.has(m.id) ? 'Present' : 'Absent'}</td>
              </tr>
            ))}
            {printMembers.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '12px 10px', fontFamily: 'Arial, sans-serif', color: '#555', fontStyle: 'italic' }}>No members found for this event.</td></tr>
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 20, paddingTop: 8, borderTop: '0.5pt solid #999', fontSize: '9pt', fontFamily: 'Arial, sans-serif', color: '#555' }}>
          <div>Printed by: {user?.full_name ?? '—'}</div>
          <div>Printed on: {new Date().toLocaleString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ marginTop: 4, fontWeight: 'bold', color: '#000' }}>CCMS — Centry Church Management System</div>
        </div>
      </div>

      {/* ── Screen content (hidden on print) ─────────────────────────────── */}
      <div id="ccms-screen-content">
        {showDeleteModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}>
            <div style={{ background: 'var(--dm-bg-card)', borderRadius: 12, border: '0.5px solid var(--dm-border-soft)', padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 8 }}>Delete Event</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                Delete <strong style={{ color: 'var(--dm-text-ink)' }}>{event.name}</strong>? All attendance records will be removed. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDeleteModal(false)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff' }}>{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/events')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dm-text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-secondary)')}>
              <BackArrowIcon />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.02em', margin: 0 }}>{event.name}</h1>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: typeStyle.bg, color: typeStyle.color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeStyle.dot }} />
                  {typeStyle.label}
                </span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-muted)', marginTop: 4 }}>
                {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                {event.location && <span> · {event.location}</span>}
                {event.branches?.name && <span> · {event.branches.name}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate(`/events/${event.id}/edit`)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}>Edit Event</button>
            <button onClick={() => window.print()} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}>Print Sheet</button>
            <button onClick={() => setShowDeleteModal(true)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid #FCA5A5', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>Delete Event</button>
          </div>
        </div>

        {/* Part of series banner */}
        {event.parent_event_id && parentEvent && (
          <div style={{ background: 'var(--dm-bg-tint)', border: '0.5px solid #C4CEEB', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M5 5l3-3 3 3M5 11l3 3 3-3" stroke="#4F6BED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#3349C7' }}>
              Part of series{event.occurrence_number ? ` · Occurrence #${event.occurrence_number}` : ''} —{' '}
              <button onClick={() => navigate(`/events/${parentEvent.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#4F6BED', padding: 0, textDecoration: 'underline' }}>
                {parentEvent.name}
              </button>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid var(--dm-border-soft)', marginBottom: 20 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: activeTab === tab.key ? '#4F6BED' : '#6B7280', borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--dm-text-body)' }}
              onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--dm-text-secondary)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'attendance' && user && <AttendanceTab event={event} orgId={user.org_id} />}
        {activeTab === 'donations' && <DonationsTab eventId={event.id} />}
        {activeTab === 'qr' && <QRTab eventId={event.id} />}
      </div>
    </>
  )
}

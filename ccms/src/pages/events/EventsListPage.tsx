import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventTab = 'upcoming' | 'past' | 'recurring'

interface Branch { id: string; name: string }

interface Event {
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
  recurrence_rule: { frequency: string; end_date: string } | null
  parent_event_id: string | null
  occurrence_number: number | null
  created_at: string
  branches: { id: string; name: string } | null
}


// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const EVENT_TYPE_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  sunday_service:          { bg: '#E8ECF9', color: '#3349C7', dot: '#4F6BED', label: 'Sunday Service' },
  midweek_service:         { bg: '#EDE9FE', color: '#5B21B6', dot: '#8B5CF6', label: 'Midweek Service' },
  prayer_meeting:          { bg: '#F0FDFA', color: '#0F766E', dot: '#0D9488', label: 'Prayer Meeting' },
  youth_service:           { bg: '#FFF7ED', color: '#C2410C', dot: '#F97316', label: 'Youth Service' },
  special_programme:       { bg: '#FEF6E5', color: '#8A6418', dot: '#C8964A', label: 'Special Programme' },
  outreach:                { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'Outreach' },
  conference:              { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6', label: 'Conference' },
  funeral_burial_service:  { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'Funeral/Burial' },
  custom:                  { bg: '#FCE7F3', color: '#9D174D', dot: '#EC4899', label: 'Custom' },
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  scheduled:  { bg: '#DBEAFE', color: '#1E40AF', label: 'Scheduled' },
  completed:  { bg: '#DCFCE7', color: '#166534', label: 'Completed' },
  cancelled:  { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' },
  draft:      { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventTypeStyle(type: string | null) {
  return EVENT_TYPE_STYLES[type ?? ''] ?? { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: type ?? 'Event' }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
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
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M1.5 6.5h13M5 1.5V4M11 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventTypeBadge({ type }: { type: string | null }) {
  const s = getEventTypeStyle(type)
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

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status ?? ''] ?? STATUS_STYLES.scheduled
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
    <tr style={{ borderBottom: '0.5px solid #EFF1F7', height: 60 }}>
      {[28, 14, 10, 12, 10, 5].map((w, i) => (
        <td key={i} style={{ padding: '0 18px' }}>
          <div style={{ height: 12, width: `${w * 4}px`, borderRadius: 6, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  )
}

function DeleteConfirmModal({
  eventName,
  onConfirm,
  onCancel,
  deleting,
}: {
  eventName: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', borderRadius: 12, border: '0.5px solid var(--dm-border)', padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 8 }}>
          Delete Event
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--dm-text-ink)' }}>{eventName}</strong>? This will also remove all attendance records for this event. This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: deleting ? '#FCA5A5' : '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <TrashIcon /> {deleting ? 'Deleting…' : 'Delete Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
          {sub}
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EventsListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [events, setEvents] = useState<Event[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming')

  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [menuPos, setMenuPos] = useState<{ eventId: string; top: number; left: number } | null>(null)

  // Stats
  const [statsLoading, setStatsLoading] = useState(true)
  const [countThisMonth, setCountThisMonth] = useState(0)
  const [countUpcoming, setCountUpcoming] = useState(0)
  const [avgAttendanceRate, setAvgAttendanceRate] = useState<number | null>(null)
  const [topEventType, setTopEventType] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!user?.org_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*, branches(id, name)')
      .eq('org_id', user.org_id)
      .order('starts_at', { ascending: false })
    if (error) toast.error('Failed to load events')
    else setEvents((data ?? []) as Event[])
    setLoading(false)
  }, [user?.org_id])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  // Stats
  useEffect(() => {
    if (!user?.org_id) return
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
    const today = now.toISOString()
    const in14Days = new Date(now.getTime() + 14 * 86400000).toISOString()

    setStatsLoading(true)

    Promise.all([
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('org_id', user.org_id).gte('starts_at', startOfMonth).lte('starts_at', endOfMonth),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('org_id', user.org_id).gte('starts_at', today).lte('starts_at', in14Days),
      supabase.from('events').select('id, expected_attendance, event_type').eq('org_id', user.org_id).eq('status', 'completed').not('expected_attendance', 'is', null),
    ]).then(async ([monthRes, upcomingRes, completedRes]) => {
      setCountThisMonth(monthRes.count ?? 0)
      setCountUpcoming(upcomingRes.count ?? 0)

      if (completedRes.data && completedRes.data.length > 0) {
        const completedIds = completedRes.data.map((e) => e.id)
        const { data: attData } = await supabase
          .from('attendance')
          .select('event_id')
          .in('event_id', completedIds)
          .eq('present', true)

        if (attData) {
          const countByEvent = attData.reduce((acc: Record<string, number>, r: { event_id: string }) => {
            acc[r.event_id] = (acc[r.event_id] ?? 0) + 1
            return acc
          }, {})
          let totalRate = 0
          let rateCount = 0
          for (const ev of completedRes.data as Event[]) {
            if (ev.expected_attendance && ev.expected_attendance > 0) {
              const present = countByEvent[ev.id] ?? 0
              totalRate += present / ev.expected_attendance
              rateCount++
            }
          }
          setAvgAttendanceRate(rateCount > 0 ? Math.round((totalRate / rateCount) * 100) : null)
        }

        // Top event type by avg attendance
        const typeGroups: Record<string, { total: number; count: number }> = {}
        for (const ev of completedRes.data as Event[]) {
          const t = ev.event_type ?? 'other'
          if (!typeGroups[t]) typeGroups[t] = { total: 0, count: 0 }
          const present = (attData ?? []).filter((r: { event_id: string }) => r.event_id === ev.id).length
          typeGroups[t].total += present
          typeGroups[t].count++
        }
        let bestType: string | null = null
        let bestAvg = 0
        for (const [type, { total, count }] of Object.entries(typeGroups)) {
          const avg = total / count
          if (avg > bestAvg) { bestAvg = avg; bestType = type }
        }
        setTopEventType(bestType)
      }
      setStatsLoading(false)
    })
  }, [user?.org_id])

  useEffect(() => { setMenuPos(null) }, [])
  useEffect(() => {
    if (!menuPos) return
    function close() { setMenuPos(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuPos])

  useEffect(() => { setPage(1) }, [search, branchFilter, typeFilter, activeTab])

  const now = new Date()
  const today = now.toISOString()

  const tabFiltered = events.filter(e => {
    if (activeTab === 'upcoming') return (e.status === 'scheduled' || !e.status) && e.starts_at >= today
    if (activeTab === 'past') return e.status === 'completed' || e.starts_at < today
    if (activeTab === 'recurring') return !!e.recurrence_rule && !e.parent_event_id
    return true
  })

  const filtered = tabFiltered.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.speaker ?? '').toLowerCase().includes(q)
    const matchBranch = !branchFilter || e.branch_id === branchFilter
    const matchType = !typeFilter || e.event_type === typeFilter
    return matchSearch && matchBranch && matchType
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('attendance').delete().eq('event_id', deleteTarget.id)
    const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id)
    if (error) {
      toast.error('Failed to delete event')
    } else {
      toast.success('Event deleted')
      setDeleteTarget(null)
      fetchEvents()
    }
    setDeleting(false)
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

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none',
  }

  const tabs: { key: EventTab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'recurring', label: 'Recurring' },
  ]

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .ev-row:hover { background: var(--dm-bg-muted) !important; }
        .ev-filter-select:focus { border-color: #4F6BED !important; outline: none; }
        .ev-filter-input:focus { border-color: #4F6BED !important; }
      `}</style>

      {deleteTarget && (
        <DeleteConfirmModal
          eventName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {menuPos && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, minWidth: 160, padding: '4px 0' }}
        >
          {[
            { label: 'View Event', action: () => { navigate(`/events/${menuPos.eventId}`); setMenuPos(null) } },
            { label: 'Delete Event', action: () => { const ev = events.find(e => e.id === menuPos.eventId); if (ev) setDeleteTarget(ev); setMenuPos(null) }, danger: true },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: (item as { danger?: boolean }).danger ? '#EF4444' : '#374151', textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: '#111827', letterSpacing: '-0.015em', margin: '0 0 4px' }}>
            Events
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading ? 'Loading…' : `${events.length} total events · ${countUpcoming} upcoming`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/events/calendar')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <CalendarIcon /> Calendar View
          </button>
          <button
            onClick={() => navigate('/events/new')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <PlusIcon /> Create Event
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Events This Month" value={statsLoading ? '—' : countThisMonth} sub="calendar month" accent="#4F6BED" />
        <StatCard label="Upcoming (14 days)" value={statsLoading ? '—' : countUpcoming} sub="next 2 weeks" accent="#8B5CF6" />
        <StatCard label="Avg Attendance Rate" value={statsLoading || avgAttendanceRate === null ? '—' : `${avgAttendanceRate}%`} sub="completed events" accent="#22C55E" />
        <StatCard
          label="Top Event Type"
          value={statsLoading || !topEventType ? '—' : getEventTypeStyle(topEventType).label}
          sub="by avg attendance"
          accent="#C8964A"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 18 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 14px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13,
              color: activeTab === tab.key ? '#4F6BED' : '#6B7280',
              borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent',
              marginBottom: -1,
              background: 'none', cursor: 'pointer', transition: 'color 0.12s',
            }}
            onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#6B7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, padding: 14, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}><SearchIcon /></span>
          <input
            className="ev-filter-input"
            type="text"
            placeholder="Search events or speaker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }}
          />
        </div>
        <select className="ev-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option value="">All Types</option>
          {Object.entries(EVENT_TYPE_STYLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="ev-filter-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button
          onClick={() => { setSearch(''); setBranchFilter(''); setTypeFilter('') }}
          style={{ ...inputStyle, padding: '0 12px', cursor: 'pointer', color: '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500 }}
        >
          Clear Filters
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '30%' }}>Event</th>
              <th style={th}>Type</th>
              <th style={th}>Date & Time</th>
              <th style={th}>Branch</th>
              <th style={th}>Status</th>
              <th style={{ ...th, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="8" width="40" height="36" rx="4" stroke="#E5E7EB" strokeWidth="2" fill="none" />
                      <path d="M4 18h40M14 4v8M34 4v8" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, color: '#374151', fontWeight: 500 }}>
                      {events.length === 0 ? 'No events yet' : 'No events match your filters'}
                    </div>
                    {events.length === 0 && (
                      <button onClick={() => navigate('/events/new')} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        <PlusIcon /> Create First Event
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : paginated.map(ev => (
              <tr
                key={ev.id}
                className="ev-row"
                onClick={() => navigate(`/events/${ev.id}`)}
                style={{ borderBottom: '0.5px solid #EFF1F7', height: 60, background: 'var(--dm-bg-card)', transition: 'background 0.1s', cursor: 'pointer' }}
              >
                <td style={{ padding: '0 18px' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13.5, color: '#111827' }}>
                    {ev.name}
                  </div>
                  {ev.speaker && (
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {ev.speaker}
                    </div>
                  )}
                  {ev.parent_event_id && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#7B93F5', marginTop: 2 }}>
                      Occurrence #{ev.occurrence_number}
                    </div>
                  )}
                </td>
                <td style={{ padding: '0 18px' }}>
                  <EventTypeBadge type={ev.event_type} />
                </td>
                <td style={{ padding: '0 18px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#374151' }}>
                    {formatDate(ev.starts_at)}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {formatTime(ev.starts_at)}
                  </div>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151' }}>
                    {ev.branches?.name ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '0 18px' }}>
                  <StatusBadge status={ev.status} />
                </td>
                <td style={{ padding: '0 12px' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/events/${ev.id}`) }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}
                    >
                      <ArrowRightIcon />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuPos(menuPos?.eventId === ev.id ? null : { eventId: ev.id, top: rect.bottom + 4, left: rect.right - 160 })
                      }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', color: '#6B7280', fontSize: 12.5, borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE' }}>
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            {filtered.length === 0 ? '0 events' : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} events`}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronIcon dir="left" /> Previous
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              Next <ChevronIcon dir="right" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

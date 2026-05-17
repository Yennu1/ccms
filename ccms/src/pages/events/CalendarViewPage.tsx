import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface CalEvent {
  id: string
  name: string
  event_type: string | null
  status: string | null
  starts_at: string
  ends_at: string | null
  branch_id: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
  sunday_service:          '#4F6BED',
  midweek_service:         '#8B5CF6',
  prayer_meeting:          '#0D9488',
  youth_service:           '#F97316',
  special_programme:       '#C8964A',
  outreach:                '#22C55E',
  conference:              '#3B82F6',
  funeral_burial_service:  '#9CA3AF',
  custom:                  '#EC4899',
}

function getEventColor(type: string | null): string {
  return EVENT_TYPE_COLORS[type ?? ''] ?? '#6B7280'
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarViewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null)

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  const fetchEvents = async (start: Date, end: Date) => {
    if (!user?.org_id) return
    setLoading(true)
    let query = supabase
      .from('events')
      .select('id, name, event_type, status, starts_at, ends_at, branch_id')
      .eq('org_id', user.org_id)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())

    if (branchFilter) query = query.eq('branch_id', branchFilter)

    const { data } = await query.order('starts_at')
    setEvents((data ?? []) as CalEvent[])
    setLoading(false)
  }

  useEffect(() => {
    if (viewRange) fetchEvents(viewRange.start, viewRange.end)
  }, [branchFilter, user?.org_id, viewRange])

  const handleDatesSet = (arg: DatesSetArg) => {
    setViewRange({ start: arg.start, end: arg.end })
  }

  const handleEventClick = (arg: EventClickArg) => {
    navigate(`/events/${arg.event.id}`)
  }

  const calendarEvents = events.map(ev => ({
    id: ev.id,
    title: ev.name,
    start: ev.starts_at,
    end: ev.ends_at ?? undefined,
    backgroundColor: getEventColor(ev.event_type),
    borderColor: getEventColor(ev.event_type),
    textColor: '#fff',
  }))

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff',
    outline: 'none', padding: '0 10px', cursor: 'pointer',
  }

  return (
    <>
      <style>{`
        .fc { font-family: 'IBM Plex Sans', system-ui, sans-serif !important; }
        .fc .fc-toolbar-title { font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important; font-size: 18px !important; font-weight: 600 !important; color: #111827 !important; letter-spacing: -0.02em !important; }
        .fc .fc-button { font-family: 'IBM Plex Sans', system-ui, sans-serif !important; font-weight: 500 !important; font-size: 13px !important; height: 34px !important; padding: 0 12px !important; border-radius: 7px !important; border: 0.5px solid #E5E7EB !important; background: #fff !important; color: #374151 !important; transition: background 0.1s !important; }
        .fc .fc-button:hover { background: #F9FAFB !important; }
        .fc .fc-button-primary:not(.fc-button-active) { background: #fff !important; color: #374151 !important; }
        .fc .fc-button-active, .fc .fc-button-primary.fc-button-active { background: #4F6BED !important; color: #fff !important; border-color: #4F6BED !important; }
        .fc .fc-col-header-cell-cushion { font-family: 'IBM Plex Sans', system-ui, sans-serif !important; font-size: 11px !important; font-weight: 500 !important; color: #9CA3AF !important; text-transform: uppercase !important; letter-spacing: 0.06em !important; }
        .fc .fc-daygrid-day-number { font-family: 'IBM Plex Mono', monospace !important; font-size: 12px !important; color: #374151 !important; }
        .fc .fc-event { border-radius: 4px !important; padding: 2px 5px !important; font-size: 12px !important; font-weight: 500 !important; cursor: pointer !important; }
        .fc .fc-event-title { font-family: 'IBM Plex Sans', system-ui, sans-serif !important; }
        .fc td, .fc th { border-color: #F3F4F6 !important; }
        .fc .fc-scrollgrid { border: 0.5px solid #E5E7EB !important; border-radius: 0 0 12px 12px !important; overflow: hidden !important; }
        .fc .fc-daygrid-day.fc-day-today { background: #F0F2FE !important; }
        .fc .fc-list-event:hover td { background: #FAFBFE !important; }
        .fc .fc-toolbar { margin-bottom: 0 !important; }
        .fc .fc-header-toolbar { padding: 16px !important; background: #FAFBFE !important; border: 0.5px solid #E5E7EB !important; border-bottom: none !important; border-radius: 12px 12px 0 0 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: '#111827', letterSpacing: '-0.015em', margin: '0 0 4px' }}>
            Events Calendar
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading ? 'Loading events…' : `${events.length} events in view`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={() => navigate('/events')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', color: '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <ListIcon /> List View
          </button>
          <button
            onClick={() => navigate('/events/new')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <PlusIcon /> Create Event
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {Object.entries({
          sunday_service: 'Sunday Service',
          midweek_service: 'Midweek Service',
          prayer_meeting: 'Prayer Meeting',
          youth_service: 'Youth Service',
          special_programme: 'Special Programme',
          outreach: 'Outreach',
          conference: 'Conference',
          funeral_burial_service: 'Funeral/Burial',
        }).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: EVENT_TYPE_COLORS[type], flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#6B7280' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'visible' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            list: 'Agenda',
          }}
          events={calendarEvents}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventDisplay="block"
        />
      </div>
    </>
  )
}

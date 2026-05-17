import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ───────────────────────────────────────────────────────────────────

const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  event_type: z.string().min(1, 'Event type is required'),
  custom_type: z.string().optional(),
  branch_id: z.string().min(1, 'Branch is required'),
  starts_at: z.string().min(1, 'Start date/time is required'),
  ends_at: z.string().optional(),
  expected_attendance: z.number().int().positive().optional().nullable(),
  speaker: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'draft']),
  is_recurring: z.boolean(),
  recurrence_frequency: z.enum(['weekly', 'fortnightly', 'monthly']).optional(),
  recurrence_end_date: z.string().optional(),
})

type FormValues = z.infer<typeof eventSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'sunday_service',         label: 'Sunday Service' },
  { value: 'midweek_service',        label: 'Midweek Service' },
  { value: 'prayer_meeting',         label: 'Prayer Meeting' },
  { value: 'youth_service',          label: 'Youth Service' },
  { value: 'special_programme',      label: 'Special Programme' },
  { value: 'outreach',               label: 'Outreach' },
  { value: 'conference',             label: 'Conference' },
  { value: 'funeral_burial_service', label: 'Funeral/Burial Service' },
  { value: 'custom',                 label: 'Custom…' },
]

const DRAFT_KEY = 'ccms_create_event_draft'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countOccurrences(startStr: string, endStr: string, freq: 'weekly' | 'fortnightly' | 'monthly'): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    count++
    if (freq === 'weekly') cur.setDate(cur.getDate() + 7)
    else if (freq === 'fortnightly') cur.setDate(cur.getDate() + 14)
    else cur.setMonth(cur.getMonth() + 1)
    if (count > 500) break
  }
  return count
}

function generateOccurrenceDates(startStr: string, endStr: string, freq: 'weekly' | 'fortnightly' | 'monthly'): Date[] {
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return []
  const dates: Date[] = []
  const cur = new Date(start)
  while (cur <= end && dates.length < 500) {
    dates.push(new Date(cur))
    if (freq === 'weekly') cur.setDate(cur.getDate() + 7)
    else if (freq === 'fortnightly') cur.setDate(cur.getDate() + 14)
    else cur.setMonth(cur.getMonth() + 1)
  }
  return dates
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Form Field Helpers ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontWeight: 500, fontSize: 12, color: '#374151',
  display: 'block', marginBottom: 6,
}

const inputBase: React.CSSProperties = {
  width: '100%', height: 38, borderRadius: 8,
  border: '0.5px solid #E5E7EB',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 13, color: '#111827', background: '#fff',
  outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const errorStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 11.5, color: '#EF4444', marginTop: 4,
}

const sectionHeader: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontWeight: 600, fontSize: 13, color: '#111827',
  marginBottom: 14, paddingBottom: 10,
  borderBottom: '0.5px solid #F3F4F6',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreateEventPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftTimer, setDraftTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) return JSON.parse(saved)
      } catch { /* ignore */ }
      return {
        status: 'scheduled',
        is_recurring: false,
        event_type: '',
        branch_id: '',
      }
    })(),
  })

  const eventType = watch('event_type')
  const isRecurring = watch('is_recurring')
  const recurrenceFreq = watch('recurrence_frequency')
  const recurrenceEndDate = watch('recurrence_end_date')
  const startsAt = watch('starts_at')

  const occurrenceCount = isRecurring && recurrenceFreq && recurrenceEndDate && startsAt
    ? countOccurrences(startsAt, recurrenceEndDate, recurrenceFreq)
    : 0

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  // Debounced draft autosave
  const saveDraft = useCallback((values: Partial<FormValues>) => {
    if (draftTimer) clearTimeout(draftTimer)
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 2000)
      } catch { /* ignore */ }
    }, 1500)
    setDraftTimer(t)
  }, [draftTimer])

  // Watch all values for autosave
  useEffect(() => {
    const subscription = watch((values) => saveDraft(values as Partial<FormValues>))
    return () => subscription.unsubscribe()
  }, [watch, saveDraft])

  const onSubmit = async (values: FormValues) => {
    if (!user?.org_id) return
    setSubmitting(true)

    try {
      const eventTypeFinal = values.event_type === 'custom' && values.custom_type
        ? values.custom_type
        : values.event_type

      const eventData: Record<string, unknown> = {
        org_id: user.org_id,
        branch_id: values.branch_id || null,
        name: values.name,
        event_type: eventTypeFinal,
        status: values.status,
        starts_at: values.starts_at,
        ends_at: values.ends_at || null,
        expected_attendance: values.expected_attendance ?? null,
        speaker: values.speaker || null,
        location: values.location || null,
        description: values.description || null,
        recurrence_rule: values.is_recurring && values.recurrence_frequency
          ? { frequency: values.recurrence_frequency, end_date: values.recurrence_end_date }
          : null,
      }

      const { data: parentEvent, error: insertError } = await supabase
        .from('events')
        .insert(eventData)
        .select('id')
        .single()

      if (insertError || !parentEvent) {
        toast.error(`Failed to create event: ${insertError?.message ?? 'Unknown error'}`)
        setSubmitting(false)
        return
      }

      // Generate occurrences if recurring
      if (values.is_recurring && values.recurrence_frequency && values.recurrence_end_date) {
        const dates = generateOccurrenceDates(values.starts_at, values.recurrence_end_date, values.recurrence_frequency)

        const occurrenceRows = dates.map((date, idx) => ({
          org_id: user.org_id,
          branch_id: values.branch_id || null,
          name: values.name,
          event_type: eventTypeFinal,
          status: 'scheduled',
          starts_at: date.toISOString(),
          ends_at: null,
          expected_attendance: values.expected_attendance ?? null,
          speaker: values.speaker || null,
          location: values.location || null,
          parent_event_id: parentEvent.id,
          occurrence_number: idx + 1,
        }))

        if (occurrenceRows.length > 0) {
          await supabase.from('events').insert(occurrenceRows)

          // Also insert into event_occurrences table
          const eventOccRows = dates.map((date, idx) => ({
            event_id: parentEvent.id,
            org_id: user.org_id,
            occurrence_number: idx + 1,
            starts_at: date.toISOString(),
          }))
          await supabase.from('event_occurrences').insert(eventOccRows)
        }
      }

      localStorage.removeItem(DRAFT_KEY)
      toast.success('Event created successfully')
      navigate('/events')
    } catch (err) {
      toast.error('An unexpected error occurred')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '0.5px solid #E5E7EB',
    borderRadius: 12, padding: 24,
  }

  return (
    <>
      <style>{`
        .ce-input:focus { border-color: #4F6BED !important; }
        .ce-input::placeholder { color: #9CA3AF; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/events')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
        >
          <BackArrowIcon />
        </button>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            Create Event
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {draftSaved ? (
              <span style={{ color: '#22C55E' }}>Draft saved</span>
            ) : (
              <span>Draft auto-saves as you type</span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── Left Column ── */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Basic Info */}
          <div style={cardStyle}>
            <div style={sectionHeader}>Event Details</div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Event Name *</label>
              <input
                className="ce-input"
                {...register('name')}
                placeholder="e.g. Sunday Morning Service"
                style={{ ...inputBase }}
              />
              {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Event Type *</label>
                <select
                  className="ce-input"
                  {...register('event_type')}
                  style={{ ...inputBase, cursor: 'pointer' }}
                >
                  <option value="">Select type…</option>
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.event_type && <div style={errorStyle}>{errors.event_type.message}</div>}
              </div>
              <div>
                <label style={labelStyle}>Status *</label>
                <select className="ce-input" {...register('status')} style={{ ...inputBase, cursor: 'pointer' }}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {eventType === 'custom' && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Custom Event Type *</label>
                <input
                  className="ce-input"
                  {...register('custom_type')}
                  placeholder="e.g. Harvest Festival"
                  style={{ ...inputBase }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Start Date & Time *</label>
                <input
                  className="ce-input"
                  type="datetime-local"
                  {...register('starts_at')}
                  style={{ ...inputBase }}
                />
                {errors.starts_at && <div style={errorStyle}>{errors.starts_at.message}</div>}
              </div>
              <div>
                <label style={labelStyle}>End Date & Time</label>
                <input
                  className="ce-input"
                  type="datetime-local"
                  {...register('ends_at')}
                  style={{ ...inputBase }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Speaker / Preacher</label>
                <input
                  className="ce-input"
                  {...register('speaker')}
                  placeholder="e.g. Pastor John Smith"
                  style={{ ...inputBase }}
                />
              </div>
              <div>
                <label style={labelStyle}>Expected Attendance</label>
                <input
                  className="ce-input"
                  type="number"
                  min="1"
                  {...register('expected_attendance', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                  placeholder="e.g. 250"
                  style={{ ...inputBase }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Location / Venue</label>
              <input
                className="ce-input"
                {...register('location')}
                placeholder="e.g. Main Sanctuary"
                style={{ ...inputBase }}
              />
            </div>

            <div>
              <label style={labelStyle}>Description / Notes</label>
              <textarea
                className="ce-input"
                {...register('description')}
                placeholder="Additional details about this event…"
                rows={3}
                style={{ ...inputBase, height: 'auto', padding: '10px', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div style={cardStyle}>
            <div style={sectionHeader}>Recurrence</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isRecurring ? 20 : 0 }}>
              <button
                type="button"
                onClick={() => setValue('is_recurring', !isRecurring)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: isRecurring ? '#4F6BED' : '#E5E7EB',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: isRecurring ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151', fontWeight: 500 }}>
                This is a recurring event
              </span>
            </div>

            {isRecurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Frequency *</label>
                    <select
                      className="ce-input"
                      {...register('recurrence_frequency')}
                      style={{ ...inputBase, cursor: 'pointer' }}
                    >
                      <option value="">Select frequency…</option>
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly (every 2 weeks)</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Repeat Until *</label>
                    <input
                      className="ce-input"
                      type="date"
                      {...register('recurrence_end_date')}
                      style={{ ...inputBase }}
                    />
                  </div>
                </div>

                {occurrenceCount > 0 && (
                  <div style={{
                    background: '#F0F2FE', border: '0.5px solid #C4CEEB',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="#4F6BED" strokeWidth="1.4" />
                      <path d="M8 5v3.5L10 10" stroke="#4F6BED" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#3349C7', fontWeight: 500 }}>
                      This will create <strong>{occurrenceCount}</strong> occurrence{occurrenceCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Organisation */}
          <div style={cardStyle}>
            <div style={sectionHeader}>Organisation</div>
            <div>
              <label style={labelStyle}>Branch *</label>
              <select
                className="ce-input"
                {...register('branch_id')}
                style={{ ...inputBase, cursor: 'pointer' }}
              >
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {errors.branch_id && <div style={errorStyle}>{errors.branch_id.message}</div>}
            </div>
          </div>

          {/* Summary */}
          {occurrenceCount > 0 && (
            <div style={{ ...cardStyle, background: '#F0F2FE', border: '0.5px solid #C4CEEB' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#3349C7', marginBottom: 8 }}>
                Recurrence Summary
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <div><strong>{occurrenceCount}</strong> occurrences</div>
                <div>Frequency: <strong>{recurrenceFreq}</strong></div>
                <div>Ends: <strong>{recurrenceEndDate}</strong></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={cardStyle}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'block', width: '100%', height: 40,
                borderRadius: 8, border: 'none',
                background: submitting ? '#818CF8' : '#4F6BED',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13.5, color: '#fff',
                marginBottom: 10, transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Creating Event…' : 'Create Event'}
            </button>
            <button
              type="button"
              onClick={() => { localStorage.removeItem(DRAFT_KEY); navigate('/events') }}
              style={{
                display: 'block', width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid #E5E7EB',
                background: '#fff', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: '#374151',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

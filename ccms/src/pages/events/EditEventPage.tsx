import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

const KNOWN_TYPES = EVENT_TYPES.filter(t => t.value !== 'custom').map(t => t.value)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  return iso.replace(/([+-]\d{2}:\d{2}|Z)$/, '').slice(0, 16)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)',
  display: 'block', marginBottom: 6,
}

const inputBase: React.CSSProperties = {
  width: '100%', height: 38, borderRadius: 8,
  border: '0.5px solid var(--dm-border)',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
  outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const errorStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 11.5, color: '#EF4444', marginTop: 4,
}

const sectionHeader: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)',
  marginBottom: 14, paddingBottom: 10,
  borderBottom: '0.5px solid var(--dm-border-subtle)',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { status: 'scheduled', event_type: '', branch_id: '' },
  })

  const eventType = watch('event_type')

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  useEffect(() => {
    if (!id) return
    supabase.from('events').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('Event not found')
          navigate('/events')
          return
        }
        const isKnownType = KNOWN_TYPES.includes(data.event_type ?? '')
        reset({
          name: data.name ?? '',
          event_type: isKnownType ? (data.event_type ?? '') : 'custom',
          custom_type: !isKnownType ? (data.event_type ?? '') : '',
          branch_id: data.branch_id ?? '',
          starts_at: toDatetimeLocal(data.starts_at),
          ends_at: toDatetimeLocal(data.ends_at),
          expected_attendance: data.expected_attendance ?? null,
          speaker: data.speaker ?? '',
          location: data.location ?? '',
          description: data.description ?? '',
          status: (data.status ?? 'scheduled') as FormValues['status'],
        })
        setLoading(false)
      })
  }, [id, reset, navigate])

  const onSubmit = async (values: FormValues) => {
    if (!user?.org_id || !id) return
    setSubmitting(true)

    try {
      const eventTypeFinal = values.event_type === 'custom' && values.custom_type
        ? values.custom_type
        : values.event_type

      const { error } = await supabase
        .from('events')
        .update({
          name: values.name,
          event_type: eventTypeFinal,
          status: values.status,
          branch_id: values.branch_id || null,
          starts_at: values.starts_at,
          ends_at: values.ends_at || null,
          expected_attendance: values.expected_attendance ?? null,
          speaker: values.speaker || null,
          location: values.location || null,
          description: values.description || null,
        })
        .eq('id', id)

      if (error) {
        toast.error(`Failed to update event: ${error.message}`)
        setSubmitting(false)
        return
      }

      toast.success('Event updated successfully')
      navigate(`/events/${id}`)
    } catch (err) {
      toast.error('An unexpected error occurred')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
    borderRadius: 12, padding: 24,
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
      Loading event…
    </div>
  )

  return (
    <>
      <style>{`
        .ee-input:focus { border-color: #4F6BED !important; }
        .ee-input::placeholder { color: #9CA3AF; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/events/${id}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
        >
          <BackArrowIcon />
        </button>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            Edit Event
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            Update event details
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── Left Column ── */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={cardStyle}>
            <div style={sectionHeader}>Event Details</div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Event Name *</label>
              <input
                className="ee-input"
                {...register('name')}
                placeholder="e.g. Sunday Morning Service"
                style={{ ...inputBase }}
              />
              {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Event Type *</label>
                <select className="ee-input" {...register('event_type')} style={{ ...inputBase, cursor: 'pointer' }}>
                  <option value="">Select type…</option>
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.event_type && <div style={errorStyle}>{errors.event_type.message}</div>}
              </div>
              <div>
                <label style={labelStyle}>Status *</label>
                <select className="ee-input" {...register('status')} style={{ ...inputBase, cursor: 'pointer' }}>
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
                  className="ee-input"
                  {...register('custom_type')}
                  placeholder="e.g. Harvest Festival"
                  style={{ ...inputBase }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Start Date & Time *</label>
                <input className="ee-input" type="datetime-local" {...register('starts_at')} style={{ ...inputBase }} />
                {errors.starts_at && <div style={errorStyle}>{errors.starts_at.message}</div>}
              </div>
              <div>
                <label style={labelStyle}>End Date & Time</label>
                <input className="ee-input" type="datetime-local" {...register('ends_at')} style={{ ...inputBase }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Speaker / Preacher</label>
                <input className="ee-input" {...register('speaker')} placeholder="e.g. Pastor John Smith" style={{ ...inputBase }} />
              </div>
              <div>
                <label style={labelStyle}>Expected Attendance</label>
                <input
                  className="ee-input"
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
              <input className="ee-input" {...register('location')} placeholder="e.g. Main Sanctuary" style={{ ...inputBase }} />
            </div>

            <div>
              <label style={labelStyle}>Description / Notes</label>
              <textarea
                className="ee-input"
                {...register('description')}
                placeholder="Additional details about this event…"
                rows={3}
                style={{ ...inputBase, height: 'auto', padding: '10px', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={cardStyle}>
            <div style={sectionHeader}>Organisation</div>
            <div>
              <label style={labelStyle}>Branch *</label>
              <select className="ee-input" {...register('branch_id')} style={{ ...inputBase, cursor: 'pointer' }}>
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {errors.branch_id && <div style={errorStyle}>{errors.branch_id.message}</div>}
            </div>
          </div>

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
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/events/${id}`)}
              style={{
                display: 'block', width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid var(--dm-border)',
                background: 'var(--dm-bg-card)', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

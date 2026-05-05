import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Minimum 2 characters'),
  branch_id: z.string().min(1, 'Please select a branch'),
  head_member_id: z.string(),
  address: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }
interface MemberOption {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="form-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.75" />
      <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 600, fontSize: 14, color: '#111827',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 13, color: '#6B7280', marginTop: 2,
      }}>
        {subtitle}
      </div>
    </div>
  )
}

function FieldWrapper({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 500, fontSize: 12, color: '#374151',
        display: 'block', marginBottom: 4,
      }}>
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 12, color: '#EF4444', marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function MemberSearchSelect({
  members,
  value,
  onChange,
  placeholder,
  hasError,
}: {
  members: MemberOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  hasError?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = members.find(m => m.id === value)
  const displayText = selected
    ? `${selected.first_name} ${selected.last_name}${selected.member_number ? ` (${selected.member_number})` : ''}`
    : ''

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = members.filter(m => {
    const q = query.toLowerCase()
    return !q ||
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      (m.member_number ?? '').toLowerCase().includes(q)
  })

  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: `0.5px solid ${hasError ? '#EF4444' : '#E5E7EB'}`,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff',
    outline: 'none', padding: '0 32px 0 10px', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    cursor: 'pointer',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        value={open ? query : displayText}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder={placeholder ?? 'Search members...'}
        style={inputBase}
        readOnly={!open}
        onClick={() => { setQuery(''); setOpen(true) }}
      />
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', display: 'flex',
      }}>
        <ChevronDownIcon />
      </span>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '0.5px solid #E5E7EB',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 100, maxHeight: 220, overflowY: 'auto',
          padding: '4px 0',
        }}>
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setQuery('') }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 12px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: '#9CA3AF',
              borderBottom: '0.5px solid #F3F4F6',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            — None (optional)
          </button>
          {filtered.length === 0 ? (
            <div style={{
              padding: '10px 12px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: '#9CA3AF',
            }}>
              No members found
            </div>
          ) : (
            filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); setQuery('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  background: m.id === value ? '#F0F2FE' : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '8px 12px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = m.id === value ? '#F0F2FE' : 'none')}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#E8ECF9', color: '#4F6BED',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, fontSize: 13, color: '#111827',
                  }}>
                    {m.first_name} {m.last_name}
                  </div>
                  {m.member_number && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11, color: '#9CA3AF',
                    }}>
                      {m.member_number}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function HouseholdNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [branches, setBranches] = useState<Branch[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      branch_id: '',
      head_member_id: '',
      address: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!user?.org_id) return
    let active = true

    supabase.from('branches').select('id, name').eq('org_id', user.org_id)
      .then(({ data }) => { if (active && data) setBranches(data) })

    supabase
      .from('members')
      .select('id, first_name, last_name, member_number')
      .eq('org_id', user.org_id)
      .eq('membership_status', 'active')
      .order('first_name')
      .then(({ data }) => { if (active && data) setMembers(data as MemberOption[]) })

    return () => { active = false }
  }, [user?.org_id])

  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%', height: 38, borderRadius: 8,
    border: `0.5px solid ${hasError ? '#EF4444' : '#E5E7EB'}`,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff',
    outline: 'none', padding: '0 10px', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  const Divider = () => (
    <div style={{ height: '0.5px', background: '#F3F4F6', margin: '24px 0' }} />
  )

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const { error } = await supabase.from('households').insert({
        org_id: user.org_id,
        branch_id: data.branch_id,
        name: data.name,
        head_member_id: data.head_member_id || null,
        address: data.address || null,
        notes: data.notes || null,
      })

      if (error) throw error

      toast.success('Household created')
      navigate('/households')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create household. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .form-spinner { animation: spin 0.75s linear infinite; }
        .form-input::placeholder { color: #9CA3AF; }
        .form-input:focus {
          border-color: #4F6BED !important;
          box-shadow: 0 0 0 3px rgba(79,107,237,0.1) !important;
        }
        .form-input.has-error:focus {
          border-color: #EF4444 !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.1) !important;
        }
        .back-btn:hover { background: #F3F4F6 !important; }
        .cancel-btn:hover { background: #F9FAFB !important; }
        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button
            type="button"
            className="back-btn"
            onClick={() => navigate('/households')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 6px', borderRadius: 6,
              color: '#6B7280', display: 'flex', alignItems: 'center',
              transition: 'background 0.1s',
            }}
          >
            <BackArrowIcon />
          </button>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 20, color: '#111827',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            Add Household
          </h1>
        </div>
        <p style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#6B7280', margin: '0 0 0 34px',
        }}>
          Create a new family household
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{
          background: '#fff', border: '0.5px solid #E5E7EB',
          borderRadius: 12, padding: 24,
        }}>

          {/* ── Section 1: Household Details ── */}
          <SectionHeader
            title="Household Details"
            subtitle="Basic information about this family unit"
          />
          <div
            className="form-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
          >
            <FieldWrapper label="Household Name" required error={errors.name?.message}>
              <input
                {...register('name')}
                className={`form-input${errors.name ? ' has-error' : ''}`}
                placeholder="e.g. The Mensah Family"
                style={inputBase(!!errors.name)}
              />
            </FieldWrapper>

            <FieldWrapper label="Branch" required error={errors.branch_id?.message}>
              <select
                {...register('branch_id')}
                className={`form-input${errors.branch_id ? ' has-error' : ''}`}
                style={{ ...inputBase(!!errors.branch_id), cursor: 'pointer' }}
              >
                <option value="">Select branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FieldWrapper>

            <div style={{ gridColumn: '1 / -1' }}>
              <FieldWrapper label="Head of Household">
                <Controller
                  control={control}
                  name="head_member_id"
                  render={({ field }) => (
                    <MemberSearchSelect
                      members={members}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search for a member..."
                      hasError={false}
                    />
                  )}
                />
              </FieldWrapper>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <FieldWrapper label="Address">
                <input
                  {...register('address')}
                  className="form-input"
                  placeholder="Street address or location"
                  style={inputBase(false)}
                />
              </FieldWrapper>
            </div>
          </div>

          <Divider />

          {/* ── Section 2: Notes ── */}
          <SectionHeader
            title="Additional Notes"
            subtitle="Any other relevant information about this household"
          />
          <FieldWrapper label="Notes">
            <textarea
              {...register('notes')}
              className="form-input"
              placeholder="Any additional notes..."
              rows={3}
              style={{
                ...inputBase(false),
                height: 'auto',
                padding: '8px 10px',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
          </FieldWrapper>

          {/* Submit error */}
          {submitError && (
            <div style={{
              marginTop: 20,
              background: '#FEF2F2', border: '0.5px solid #FECACA',
              borderRadius: 8, padding: '12px 16px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: '#991B1B',
            }}>
              {submitError}
            </div>
          )}
        </div>

        <div style={{ height: 80 }} />

        {/* ── Sticky Action Bar ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 220, right: 0,
          background: '#fff', borderTop: '0.5px solid #E5E7EB',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 10,
        }}>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate('/households')}
            style={{
              height: 38, padding: '0 16px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#374151',
              transition: 'background 0.1s',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            style={{
              height: 38, padding: '0 20px', borderRadius: 8,
              border: 'none',
              background: submitting ? '#818CF8' : '#4F6BED',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#fff',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {submitting && <SpinnerIcon />}
            {submitting ? 'Saving…' : 'Save Household'}
          </button>
        </div>
      </form>
    </>
  )
}

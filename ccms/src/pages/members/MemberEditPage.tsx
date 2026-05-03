import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:        z.string().min(2, 'Minimum 2 characters'),
  last_name:         z.string().min(2, 'Minimum 2 characters'),
  email:             z.string().refine(
    val => val.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: 'Invalid email address' }
  ),
  phone:             z.string(),
  date_of_birth:     z.string(),
  gender:            z.string(),
  marital_status:    z.string(),
  occupation:        z.string(),
  address:           z.string(),
  city:              z.string(),
  membership_date:   z.string(),
  baptism_date:      z.string(),
  membership_status: z.string().min(1, 'Required'),
  branch_id:         z.string().min(1, 'Please select a branch'),
  ministry_id:       z.string(),
  notes:             z.string(),
})

type FormValues = z.infer<typeof schema>

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Branch   { id: string; name: string }
interface Ministry { id: string; name: string }

interface MemberData {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  occupation: string | null
  address: string | null
  city: string | null
  membership_date: string | null
  baptism_date: string | null
  membership_status: string
  branch_id: string | null
  notes: string | null
  branches: { id: string; name: string } | null
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
    <svg className="edit-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.75" />
      <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
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

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBar({ width, height = 14 }: { width: number | string; height?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 4,
      background: '#E5E7EB',
      animation: 'sk-pulse 1.4s ease-in-out infinite',
    }} />
  )
}

function SkeletonField() {
  return (
    <div>
      <SkeletonBar width={80} height={10} />
      <div style={{ marginTop: 6 }}><SkeletonBar width="100%" height={38} /></div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <>
      <style>{`@keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <SkeletonBar width={30} height={30} />
          <SkeletonBar width={140} height={24} />
        </div>
        <div style={{ marginLeft: 34 }}>
          <SkeletonBar width={160} height={13} />
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
        {/* Section 1 */}
        <div style={{ marginBottom: 20 }}>
          <SkeletonBar width={150} height={14} />
          <div style={{ marginTop: 4 }}><SkeletonBar width={200} height={12} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[...Array(6)].map((_, i) => <SkeletonField key={i} />)}
        </div>

        <div style={{ height: '0.5px', background: '#F3F4F6', margin: '24px 0' }} />

        {/* Section 2 */}
        <div style={{ marginBottom: 20 }}>
          <SkeletonBar width={120} height={14} />
          <div style={{ marginTop: 4 }}><SkeletonBar width={160} height={12} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonField key={i} />)}
        </div>

        <div style={{ height: '0.5px', background: '#F3F4F6', margin: '24px 0' }} />

        {/* Section 3 */}
        <div style={{ marginBottom: 20 }}>
          <SkeletonBar width={130} height={14} />
          <div style={{ marginTop: 4 }}><SkeletonBar width={180} height={12} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[...Array(5)].map((_, i) => <SkeletonField key={i} />)}
        </div>

        <div style={{ height: '0.5px', background: '#F3F4F6', margin: '24px 0' }} />

        {/* Section 4 */}
        <div style={{ marginBottom: 20 }}>
          <SkeletonBar width={120} height={14} />
          <div style={{ marginTop: 4 }}><SkeletonBar width={150} height={12} /></div>
        </div>
        <SkeletonBar width="100%" height={88} />
      </div>
    </>
  )
}

// ─── Not Found ─────────────────────────────────────────────────────────────────

function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 0', gap: 8,
    }}>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 600, fontSize: 18, color: '#111827',
      }}>
        Member not found
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 13, color: '#6B7280',
      }}>
        This member may have been removed.
      </div>
      <button
        onClick={() => navigate('/members')}
        style={{
          marginTop: 8, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#4F6BED',
        }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        Back to Members
      </button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function MemberEditPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [member,      setMember]      = useState<MemberData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [branches,    setBranches]    = useState<Branch[]>([])
  const [ministries,  setMinistries]  = useState<Ministry[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '',
      date_of_birth: '', gender: '', marital_status: '', occupation: '',
      address: '', city: '', membership_date: '', baptism_date: '',
      membership_status: 'active', branch_id: '', ministry_id: '', notes: '',
    },
  })

  // Fetch member
  useEffect(() => {
    if (!id) return
    let active = true
    supabase
      .from('members')
      .select('*, branches(id, name)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) {
          setNotFound(true)
        } else {
          setMember(data as MemberData)
        }
        setLoading(false)
      })
    return () => { active = false }
  }, [id])

  // Pre-fill form once member data is loaded
  useEffect(() => {
    if (!member) return
    reset({
      first_name:        member.first_name,
      last_name:         member.last_name,
      email:             member.email             ?? '',
      phone:             member.phone             ?? '',
      date_of_birth:     member.date_of_birth     ?? '',
      gender:            member.gender            ?? '',
      marital_status:    member.marital_status    ?? '',
      occupation:        member.occupation        ?? '',
      address:           member.address           ?? '',
      city:              member.city              ?? '',
      membership_date:   member.membership_date   ?? '',
      baptism_date:      member.baptism_date      ?? '',
      membership_status: member.membership_status,
      branch_id:         member.branch_id         ?? '',
      ministry_id:       '',
      notes:             member.notes             ?? '',
    })
  }, [member, reset])

  // Fetch branch/ministry dropdowns
  useEffect(() => {
    if (!user?.org_id) return
    let active = true
    supabase.from('branches').select('id, name').eq('org_id', user.org_id)
      .then(({ data }) => { if (active && data) setBranches(data) })
    supabase.from('ministries').select('id, name').eq('org_id', user.org_id)
      .then(({ data }) => { if (active && data) setMinistries(data) })
    return () => { active = false }
  }, [user?.org_id])

  const onSubmit = async (data: FormValues) => {
    if (!id) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const { error } = await supabase
        .from('members')
        .update({
          first_name:        data.first_name,
          last_name:         data.last_name,
          email:             data.email             || null,
          phone:             data.phone             || null,
          date_of_birth:     data.date_of_birth     || null,
          gender:            data.gender            || null,
          marital_status:    data.marital_status    || null,
          occupation:        data.occupation        || null,
          address:           data.address           || null,
          city:              data.city              || null,
          membership_date:   data.membership_date   || null,
          baptism_date:      data.baptism_date      || null,
          membership_status: data.membership_status,
          branch_id:         data.branch_id,
          notes:             data.notes             || null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      toast.success('Member updated successfully')
      navigate(`/members/${id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update member. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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

  if (loading) return <FormSkeleton />
  if (notFound || !member) return <NotFound />

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .edit-spinner { animation: spin 0.75s linear infinite; }
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
            onClick={() => navigate(`/members/${id}`)}
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
            Edit Member
          </h1>
        </div>
        <p style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#6B7280', margin: '0 0 0 34px',
        }}>
          {member.first_name} {member.last_name}
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{
          background: '#fff', border: '0.5px solid #E5E7EB',
          borderRadius: 12, padding: 24,
        }}>

          {/* ── Section 1: Personal Information ── */}
          <SectionHeader
            title="Personal Information"
            subtitle="Basic personal details for this member"
          />
          <div
            className="form-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
          >
            <FieldWrapper label="First Name" required error={errors.first_name?.message}>
              <input
                {...register('first_name')}
                className={`form-input${errors.first_name ? ' has-error' : ''}`}
                placeholder="e.g. Kwame"
                style={inputBase(!!errors.first_name)}
              />
            </FieldWrapper>

            <FieldWrapper label="Last Name" required error={errors.last_name?.message}>
              <input
                {...register('last_name')}
                className={`form-input${errors.last_name ? ' has-error' : ''}`}
                placeholder="e.g. Mensah"
                style={inputBase(!!errors.last_name)}
              />
            </FieldWrapper>

            <FieldWrapper label="Date of Birth">
              <input
                {...register('date_of_birth')}
                type="date"
                className="form-input"
                style={inputBase(false)}
              />
            </FieldWrapper>

            <FieldWrapper label="Gender">
              <select
                {...register('gender')}
                className="form-input"
                style={{ ...inputBase(false), cursor: 'pointer' }}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </FieldWrapper>

            <FieldWrapper label="Marital Status">
              <select
                {...register('marital_status')}
                className="form-input"
                style={{ ...inputBase(false), cursor: 'pointer' }}
              >
                <option value="">Select status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </FieldWrapper>

            <FieldWrapper label="Occupation">
              <input
                {...register('occupation')}
                className="form-input"
                placeholder="e.g. Teacher"
                style={inputBase(false)}
              />
            </FieldWrapper>
          </div>

          <Divider />

          {/* ── Section 2: Contact Details ── */}
          <SectionHeader
            title="Contact Details"
            subtitle="How to reach this member"
          />
          <div
            className="form-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
          >
            <FieldWrapper label="Email Address" error={errors.email?.message}>
              <input
                {...register('email')}
                type="email"
                className={`form-input${errors.email ? ' has-error' : ''}`}
                placeholder="e.g. kwame@example.com"
                style={inputBase(!!errors.email)}
              />
            </FieldWrapper>

            <FieldWrapper label="Phone Number">
              <input
                {...register('phone')}
                type="tel"
                className="form-input"
                placeholder="e.g. +233 24 000 0000"
                style={inputBase(false)}
              />
            </FieldWrapper>

            <FieldWrapper label="Address">
              <input
                {...register('address')}
                className="form-input"
                placeholder="Street address"
                style={inputBase(false)}
              />
            </FieldWrapper>

            <FieldWrapper label="City">
              <input
                {...register('city')}
                className="form-input"
                placeholder="e.g. Accra"
                style={inputBase(false)}
              />
            </FieldWrapper>
          </div>

          <Divider />

          {/* ── Section 3: Church Information ── */}
          <SectionHeader
            title="Church Information"
            subtitle="Membership and congregation details"
          />
          <div
            className="form-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
          >
            <FieldWrapper label="Membership Date">
              <input
                {...register('membership_date')}
                type="date"
                className="form-input"
                style={inputBase(false)}
              />
            </FieldWrapper>

            <FieldWrapper label="Baptism Date">
              <input
                {...register('baptism_date')}
                type="date"
                className="form-input"
                style={inputBase(false)}
              />
            </FieldWrapper>

            <FieldWrapper label="Membership Status" required error={errors.membership_status?.message}>
              <select
                {...register('membership_status')}
                className={`form-input${errors.membership_status ? ' has-error' : ''}`}
                style={{ ...inputBase(!!errors.membership_status), cursor: 'pointer' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="transferred">Transferred</option>
                <option value="deceased">Deceased</option>
              </select>
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

            <FieldWrapper label="Ministry">
              <select
                {...register('ministry_id')}
                className="form-input"
                style={{ ...inputBase(false), cursor: 'pointer' }}
              >
                <option value="">Select ministry (optional)</option>
                {ministries.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </FieldWrapper>
          </div>

          <Divider />

          {/* ── Section 4: Additional Notes ── */}
          <SectionHeader
            title="Additional Notes"
            subtitle="Any other relevant information"
          />
          <FieldWrapper label="Notes">
            <textarea
              {...register('notes')}
              className="form-input"
              placeholder="Any additional notes about this member..."
              rows={4}
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

        {/* Spacer so content isn't hidden behind fixed bar */}
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
            onClick={() => navigate(`/members/${id}`)}
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
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}

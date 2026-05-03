import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format, formatDistance } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'transferred' | 'deceased'

interface GroupMembership {
  id: string
  role: string
  groups: {
    id: string
    name: string
    ministries: { id: string; name: string } | null
  } | null
}

interface Member {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  membership_status: MemberStatus
  member_number: string | null
  created_at: string
  membership_date: string | null
  baptism_date: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  occupation: string | null
  employer: string | null
  address: string | null
  city: string | null
  notes: string | null
  branches: { id: string; name: string } | null
  group_memberships: GroupMembership[] | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<MemberStatus, { bg: string; color: string; label: string }> = {
  active:      { bg: '#DCFCE7', color: '#166534', label: 'Active' },
  inactive:    { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive' },
  transferred: { bg: '#EEF2FF', color: '#4338CA', label: 'Transferred' },
  deceased:    { bg: '#FEE2E2', color: '#991B1B', label: 'Deceased' },
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '0.5px solid #E5E7EB',
  borderRadius: 12,
  padding: 24,
}

const cardHeaderStyle: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#111827',
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: '0.5px solid #F3F4F6',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), 'MMM dd, yyyy') } catch { return '—' }
}

function capitalize(s: string | null): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | undefined }) {
  const s = STATUS_STYLES[status?.toLowerCase() as MemberStatus]
    ?? { bg: '#F3F4F6', color: '#6B7280', label: status ?? 'Unknown' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 5, padding: '3px 10px',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500, fontSize: 12,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 500, fontSize: 11, color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 400, fontSize: 14, color: '#111827',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonBar({ width, height = 14 }: { width: number | string; height?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 4,
      background: '#E5E7EB',
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

function LoadingSkeleton() {
  const skField = (w = 120) => (
    <div>
      <SkeletonBar width={60} height={10} />
      <div style={{ marginTop: 6 }}><SkeletonBar width={w} height={14} /></div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <SkeletonBar width={200} height={24} />
        <SkeletonBar width={120} height={36} />
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <SkeletonBar width={160} height={14} />
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[...Array(6)].map((_, i) => <div key={i}>{skField([100, 100, 80, 60, 100, 120][i])}</div>)}
            </div>
          </div>
          <div style={cardStyle}>
            <SkeletonBar width={140} height={14} />
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {skField(160)}{skField(100)}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <SkeletonBar width={120} height={14} />
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[90, 80, 60, 80, 80, 100, 60].map((w, i) => <div key={i}>{skField(w)}</div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Not Found State ──────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [toggling, setToggling] = useState(false)

  // user is available for future role-gated actions
  void user

  const fetchMember = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        branches(id, name),
        group_memberships(
          id, role,
          groups(
            id, name,
            ministries(id, name)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      setNotFound(true)
    } else {
      setMember(data as Member)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMember()
  }, [id])

  const toggleStatus = async () => {
    if (!member || toggling) return
    const newStatus = member.membership_status === 'active' ? 'inactive' : 'active'
    setToggling(true)
    await supabase
      .from('members')
      .update({ membership_status: newStatus })
      .eq('id', member.id)
    await fetchMember()
    setToggling(false)
  }

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <LoadingSkeleton />
      </>
    )
  }

  if (notFound || !member) {
    return <NotFound />
  }

  const memberSince = member.membership_date
    ? formatDistance(new Date(member.membership_date), new Date(), { addSuffix: true })
    : '—'

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/members')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
          >
            <BackArrowIcon />
          </button>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 20, color: '#111827',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            {member.first_name} {member.last_name}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={member.membership_status} />
          <button
            onClick={() => navigate(`/members/${member.id}/edit`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 38, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              cursor: 'pointer', color: '#374151',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F6BED')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <EditIcon /> Edit Member
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Personal Information */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Personal Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <Field label="First Name">{member.first_name || '—'}</Field>
              <Field label="Last Name">{member.last_name || '—'}</Field>
              <Field label="Date of Birth">{formatDate(member.date_of_birth)}</Field>
              <Field label="Gender">{capitalize(member.gender)}</Field>
              <Field label="Marital Status">{capitalize(member.marital_status)}</Field>
              <Field label="Occupation">{member.occupation || '—'}</Field>
              <Field label="Employer">{member.employer || '—'}</Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Address">{member.address || '—'}</Field>
              </div>
              <Field label="City">{member.city || '—'}</Field>
            </div>
          </div>

          {/* Contact Information */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <Field label="Email Address">
                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 14, color: '#4F6BED', textDecoration: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {member.email}
                  </a>
                ) : '—'}
              </Field>
              <Field label="Phone Number">
                {member.phone ? (
                  <a
                    href={`tel:${member.phone}`}
                    style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 14, color: '#4F6BED', textDecoration: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {member.phone}
                  </a>
                ) : '—'}
              </Field>
            </div>
          </div>

          {/* Ministry & Groups */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Ministry & Groups</div>
            {member.group_memberships && member.group_memberships.length > 0 ? (
              <div>
                {member.group_memberships.map((gm, i) => (
                  <div
                    key={gm.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: i < member.group_memberships!.length - 1
                        ? '0.5px solid #F3F4F6'
                        : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontWeight: 500, fontSize: 13, color: '#111827',
                      }}>
                        {gm.groups?.name ?? '—'}
                      </span>
                      {gm.groups?.ministries && (
                        <span style={{
                          background: '#E8ECF9', color: '#4F6BED',
                          borderRadius: 5, padding: '2px 8px',
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 500, fontSize: 11,
                        }}>
                          {gm.groups.ministries.name}
                        </span>
                      )}
                    </div>
                    <span style={{
                      background: gm.role === 'leader' ? '#FFF8EC' : '#F3F4F6',
                      color: gm.role === 'leader' ? '#C8964A' : '#6B7280',
                      borderRadius: 5, padding: '2px 8px',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 11,
                    }}>
                      {capitalize(gm.role)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#9CA3AF',
                textAlign: 'center', padding: 24,
              }}>
                Not assigned to any groups yet
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Church Information */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Church Information</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 11, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
              }}>
                Member Number
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13, color: '#4F6BED',
              }}>
                {member.member_number ?? '—'}
              </div>
            </div>

            <Field label="Branch">{member.branches?.name ?? '—'}</Field>

            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 11, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
              }}>
                Membership Status
              </div>
              <StatusBadge status={member.membership_status} />
            </div>

            <Field label="Membership Date">{formatDate(member.membership_date)}</Field>
            <Field label="Baptism Date">{formatDate(member.baptism_date)}</Field>
            <Field label="Member Since">{memberSince}</Field>
            <Field label="Recorded By">System</Field>
          </div>

          {/* Quick Actions */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Actions</div>

            <button
              onClick={() => navigate(`/members/${member.id}/edit`)}
              style={{
                display: 'block', width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid #E5E7EB',
                background: '#fff', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: '#374151',
                marginBottom: 8, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
            >
              Edit Member
            </button>

            <div style={{ height: '0.5px', background: '#F3F4F6', margin: '8px 0' }} />

            {member.membership_status === 'active' ? (
              <button
                onClick={toggleStatus}
                disabled={toggling}
                style={{
                  display: 'block', width: '100%', height: 38,
                  borderRadius: 8, border: '0.5px solid #FCA5A5',
                  background: '#fff',
                  cursor: toggling ? 'not-allowed' : 'pointer',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500, fontSize: 13, color: '#EF4444',
                  opacity: toggling ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {toggling ? 'Updating…' : 'Deactivate Member'}
              </button>
            ) : (
              <button
                onClick={toggleStatus}
                disabled={toggling}
                style={{
                  display: 'block', width: '100%', height: 38,
                  borderRadius: 8, border: '0.5px solid #86EFAC',
                  background: '#fff',
                  cursor: toggling ? 'not-allowed' : 'pointer',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500, fontSize: 13, color: '#22C55E',
                  opacity: toggling ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {toggling ? 'Updating…' : 'Activate Member'}
              </button>
            )}
          </div>

          {/* Notes */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Notes</div>
            {member.notes ? (
              <p style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#6B7280',
                fontStyle: 'italic', margin: 0, lineHeight: 1.6,
              }}>
                {member.notes}
              </p>
            ) : (
              <p style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#9CA3AF',
                margin: 0,
              }}>
                No notes added.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

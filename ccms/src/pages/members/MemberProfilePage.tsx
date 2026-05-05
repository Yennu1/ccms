import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format, formatDistance } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'transferred' | 'deceased'
type RelationshipType = 'spouse' | 'parent' | 'child' | 'sibling'

interface GroupMembership {
  id: string
  role: string
  groups: {
    id: string
    name: string
    ministries: { id: string; name: string } | null
  } | null
}

interface RelatedMember {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
  membership_status: string
}

interface Relationship {
  id: string
  relationship_type: RelationshipType
  related_member: RelatedMember | null
}

interface MemberOption {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
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

const RELATIONSHIP_STYLES: Record<RelationshipType, { bg: string; color: string; label: string }> = {
  spouse:  { bg: '#FEE2E2', color: '#991B1B',  label: 'Spouse'  },
  parent:  { bg: '#EEF2FF', color: '#4338CA',  label: 'Parent'  },
  child:   { bg: '#DCFCE7', color: '#166534',  label: 'Child'   },
  sibling: { bg: '#FFF8EC', color: '#C8964A',  label: 'Sibling' },
}

const INVERSE: Record<RelationshipType, RelationshipType> = {
  spouse:  'spouse',
  parent:  'child',
  child:   'parent',
  sibling: 'sibling',
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

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

function RelationshipBadge({ type }: { type: RelationshipType }) {
  const s = RELATIONSHIP_STYLES[type] ?? { bg: '#F3F4F6', color: '#6B7280', label: type }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 5, padding: '2px 8px',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500, fontSize: 11,
      display: 'inline-block', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {s.label}
    </span>
  )
}

function MiniAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: '#E8ECF9', color: '#4F6BED',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
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

// ─── Add Relationship Modal ───────────────────────────────────────────────────

function AddRelationshipModal({
  memberId,
  orgId,
  onAdd,
  onClose,
}: {
  memberId: string
  orgId: string
  onAdd: () => void
  onClose: () => void
}) {
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [relType, setRelType] = useState<RelationshipType | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('members')
      .select('id, first_name, last_name, member_number')
      .eq('org_id', orgId)
      .neq('id', memberId)
      .order('first_name')
      .then(({ data }) => {
        if (data) setMembers(data as MemberOption[])
        setLoadingMembers(false)
      })
  }, [orgId, memberId])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedMember = members.find(m => m.id === selectedId)
  const displayText = selectedMember
    ? `${selectedMember.first_name} ${selectedMember.last_name}${selectedMember.member_number ? ` (${selectedMember.member_number})` : ''}`
    : ''

  const filtered = members.filter(m => {
    const q = query.toLowerCase()
    return !q ||
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      (m.member_number ?? '').toLowerCase().includes(q)
  })

  const handleSubmit = async () => {
    if (!selectedId || !relType) return
    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('member_relationships')
      .insert({
        org_id: orgId,
        member_id: memberId,
        related_member_id: selectedId,
        relationship_type: relType,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Automatically insert the inverse so both profiles show the link
    await supabase
      .from('member_relationships')
      .insert({
        org_id: orgId,
        member_id: selectedId,
        related_member_id: memberId,
        relationship_type: INVERSE[relType],
      })

    toast.success('Relationship added')
    onAdd()
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff',
    outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 12, color: '#374151',
    display: 'block', marginBottom: 6,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 12,
        border: '0.5px solid #E5E7EB',
        padding: 24, width: 460, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 600, fontSize: 16, color: '#111827',
          marginBottom: 6,
        }}>
          Add Family Relationship
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#6B7280', marginBottom: 20,
        }}>
          Link this member to another member in your church.
        </div>

        {/* Member searchable select */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Member</label>
          {loadingMembers ? (
            <div style={{ height: 38, background: '#F3F4F6', borderRadius: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
          ) : (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input
                type="text"
                value={dropdownOpen ? query : displayText}
                onChange={e => { setQuery(e.target.value); setDropdownOpen(true) }}
                onFocus={() => { setQuery(''); setDropdownOpen(true) }}
                onClick={() => { setQuery(''); setDropdownOpen(true) }}
                placeholder="Search members..."
                style={{ ...inputBase, paddingRight: 32, cursor: 'pointer' }}
                readOnly={!dropdownOpen}
              />
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', display: 'flex',
              }}>
                <ChevronDownIcon />
              </span>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: '#fff', border: '0.5px solid #E5E7EB',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  zIndex: 200, maxHeight: 200, overflowY: 'auto',
                  padding: '4px 0',
                }}>
                  {filtered.length === 0 ? (
                    <div style={{
                      padding: '10px 12px',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 13, color: '#9CA3AF',
                    }}>
                      No members found
                    </div>
                  ) : filtered.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedId(m.id); setDropdownOpen(false); setQuery('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', textAlign: 'left',
                        background: m.id === selectedId ? '#F0F2FE' : 'none',
                        border: 'none', cursor: 'pointer',
                        padding: '8px 12px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = m.id === selectedId ? '#F0F2FE' : 'none')}
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Relationship type */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Relationship Type</label>
          <div style={{ position: 'relative' }}>
            <select
              value={relType}
              onChange={e => setRelType(e.target.value as RelationshipType | '')}
              style={{
                ...inputBase,
                appearance: 'none',
                WebkitAppearance: 'none',
                paddingRight: 32,
                cursor: 'pointer',
                color: relType ? '#111827' : '#9CA3AF',
              }}
            >
              <option value="" disabled>Select relationship...</option>
              <option value="spouse">Spouse</option>
              <option value="parent">Parent (I am their parent)</option>
              <option value="child">Child (I am their child)</option>
              <option value="sibling">Sibling</option>
            </select>
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', display: 'flex',
            }}>
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '0.5px solid #FECACA',
            borderRadius: 8, padding: '10px 12px',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#991B1B', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#374151',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId || !relType || saving}
            style={{
              height: 36, padding: '0 16px', borderRadius: 8,
              border: 'none',
              background: !selectedId || !relType || saving ? '#818CF8' : '#4F6BED',
              cursor: !selectedId || !relType || saving ? 'not-allowed' : 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#fff',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Adding…' : 'Add Relationship'}
          </button>
        </div>
      </div>
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

  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null)
  const [removingRelId, setRemovingRelId] = useState<string | null>(null)
  const [showAddRel, setShowAddRel] = useState(false)

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

  const fetchRelationships = async () => {
    if (!id || !user) return
    const { data } = await supabase
      .from('member_relationships')
      .select(`
        id,
        relationship_type,
        related_member:members!member_relationships_related_member_id_fkey(
          id, first_name, last_name, member_number, membership_status
        )
      `)
      .eq('member_id', id)
      .eq('org_id', user.org_id)
    setRelationships((data ?? []) as unknown as Relationship[])
  }

  useEffect(() => {
    fetchMember()
  }, [id])

  useEffect(() => {
    if (user) fetchRelationships()
  }, [id, user])

  const handleRemoveRelationship = async (relId: string) => {
    setRemovingRelId(relId)
    await supabase.from('member_relationships').delete().eq('id', relId)
    await fetchRelationships()
    setRemovingRelId(null)
  }

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

      {showAddRel && user && (
        <AddRelationshipModal
          memberId={member.id}
          orgId={user.org_id}
          onAdd={async () => { setShowAddRel(false); await fetchRelationships() }}
          onClose={() => setShowAddRel(false)}
        />
      )}

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

          {/* Family Relationships */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Family Relationships</div>

            {relationships.length === 0 ? (
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#9CA3AF',
                padding: '8px 0 16px',
              }}>
                No family relationships recorded.
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {relationships.map((rel, i) => {
                  const rm = rel.related_member
                  if (!rm) return null
                  const isHovered = hoveredRelId === rel.id
                  const isRemoving = removingRelId === rel.id
                  return (
                    <div
                      key={rel.id}
                      onMouseEnter={() => setHoveredRelId(rel.id)}
                      onMouseLeave={() => setHoveredRelId(null)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 0',
                        borderBottom: i < relationships.length - 1 ? '0.5px solid #F3F4F6' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <MiniAvatar firstName={rm.first_name} lastName={rm.last_name} />
                        <div style={{ minWidth: 0 }}>
                          <button
                            onClick={() => navigate(`/members/${rm.id}`)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 0, textAlign: 'left', display: 'block',
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontWeight: 500, fontSize: 13,
                              color: isHovered ? '#4F6BED' : '#111827',
                              transition: 'color 0.1s',
                            }}
                          >
                            {rm.first_name} {rm.last_name}
                          </button>
                          {rm.member_number && (
                            <div style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: 11, color: '#9CA3AF', marginTop: 1,
                            }}>
                              {rm.member_number}
                            </div>
                          )}
                        </div>
                        <RelationshipBadge type={rel.relationship_type} />
                      </div>

                      <button
                        onClick={() => handleRemoveRelationship(rel.id)}
                        disabled={isRemoving}
                        title="Remove relationship"
                        style={{
                          background: 'none', border: 'none',
                          cursor: isRemoving ? 'not-allowed' : 'pointer',
                          color: '#9CA3AF', fontSize: 20, lineHeight: 1,
                          padding: '0 4px', borderRadius: 4, flexShrink: 0,
                          opacity: isHovered || isRemoving ? 1 : 0,
                          transition: 'opacity 0.15s, color 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setShowAddRel(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid #4F6BED',
                background: '#fff', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: '#4F6BED',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F2FE')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              + Add Relationship
            </button>
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

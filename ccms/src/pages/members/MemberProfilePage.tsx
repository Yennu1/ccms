import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format, formatDistance } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'visitor' | 'pending' | 'transferred' | 'deceased'
type RelationshipType = 'spouse' | 'parent' | 'child' | 'sibling'

interface GroupMembership {
  id: string
  role: string
  joined_at: string | null
  groups: {
    id: string
    name: string
    ministries: { id: string; name: string } | null
  } | null
}

interface GroupMembershipFull {
  id: string
  role: string
  joined_at: string | null
  left_at: string | null
  is_active: boolean
  groups: {
    id: string
    name: string
    meeting_schedule: string | null
    ministries: { id: string; name: string } | null
  } | null
}

interface SidebarGroupMembership {
  id: string
  role: string
  joined_at: string | null
  groups: {
    id: string
    name: string
    meeting_schedule: string | null
    ministries: { id: string; name: string } | null
  } | null
}

interface GroupOption {
  id: string
  name: string
  ministries: { id: string; name: string } | null
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

interface Transaction {
  amount: number
  transaction_date: string
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

const STATUS_STYLES: Record<MemberStatus, { bg: string; color: string; dot: string; label: string }> = {
  active:      { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'Active' },
  inactive:    { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'Inactive' },
  visitor:     { bg: '#DBEAFE', color: '#1E40AF', dot: '#60A5FA', label: 'Visitor' },
  pending:     { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', label: 'Pending' },
  transferred: { bg: '#EEF2FF', color: '#4338CA', dot: '#818CF8', label: 'Transferred' },
  deceased:    { bg: '#FEE2E2', color: '#991B1B', dot: '#F87171', label: 'Deceased' },
}

const AVATAR_PALETTE = [
  { bg: '#E8ECF9', color: '#4F6BED' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F0FDFA', color: '#0F766E' },
  { bg: '#F5F3FF', color: '#7C3AED' },
]

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
  background: 'var(--dm-bg-card)',
  border: '0.5px solid var(--dm-border)',
  borderRadius: 12,
  padding: 24,
}

const cardHeaderStyle: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--dm-text-ink)',
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: '0.5px solid var(--dm-border-subtle)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(firstName: string, lastName: string): { bg: string; color: string } {
  const str = (firstName + lastName).toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), 'MMM dd, yyyy') } catch { return '—' }
}

function capitalize(s: string | null): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function formatAmount(amount: number): string {
  return `₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function parseMeetingSchedule(s: string | null): { day: string; time: string; venue: string } | null {
  if (!s) return null
  const parts = s.split(' · ')
  if (parts.length < 2) return null
  return { day: parts[0] ?? '', time: parts[1] ?? '', venue: parts[2] ?? '' }
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

function EnvelopeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
    ?? { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: status ?? 'Unknown' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 5, padding: '3px 10px',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 500, fontSize: 12,
      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: s.dot, flexShrink: 0,
      }} />
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
  const { bg, color } = getAvatarColor(firstName, lastName)
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: bg, color,
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
        fontWeight: 500, fontSize: 11, color: 'var(--dm-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 400, fontSize: 14, color: 'var(--dm-text-ink)',
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
    border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
    outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)',
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
        background: 'var(--dm-bg-card)', borderRadius: 12,
        border: '0.5px solid var(--dm-border)',
        padding: 24, width: 460, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)',
          marginBottom: 6,
        }}>
          Add Family Relationship
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20,
        }}>
          Link this member to another member in your church.
        </div>

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
                  background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
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
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
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
              border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
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

// ─── Assign to Group Modal ────────────────────────────────────────────────────

function AssignToGroupModal({
  memberId,
  orgId,
  existingGroupIds,
  onAssign,
  onClose,
}: {
  memberId: string
  orgId: string
  existingGroupIds: string[]
  onAssign: () => void
  onClose: () => void
}) {
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [role, setRole] = useState<'member' | 'leader'>('member')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('groups')
      .select('id, name, ministries(id, name)')
      .eq('org_id', orgId)
      .order('name')
      .then(({ data }) => {
        if (data) setGroups((data as unknown as GroupOption[]).filter(g => !existingGroupIds.includes(g.id)))
        setLoadingGroups(false)
      })
  }, [orgId])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const filtered = groups.filter(g => {
    const q = query.toLowerCase()
    return !q || g.name.toLowerCase().includes(q) || (g.ministries?.name ?? '').toLowerCase().includes(q)
  })

  const handleSubmit = async () => {
    if (!selectedGroupId) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('group_memberships')
      .insert({
        org_id: orgId,
        group_id: selectedGroupId,
        member_id: memberId,
        role,
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
      })
    if (err) { setError(err.message); setSaving(false); return }
    toast.success('Member assigned to group')
    onAssign()
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
    outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)',
    display: 'block', marginBottom: 6,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', borderRadius: 12, border: '0.5px solid var(--dm-border)', padding: 24, width: 460, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 6 }}>
          Assign to Group
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20 }}>
          Add this member to a group in your church.
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Group</label>
          {loadingGroups ? (
            <div style={{ height: 38, background: '#F3F4F6', borderRadius: 8 }} />
          ) : (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <input
                type="text"
                value={dropdownOpen ? query : selectedGroup?.name ?? ''}
                onChange={e => { setQuery(e.target.value); setDropdownOpen(true) }}
                onFocus={() => { setQuery(''); setDropdownOpen(true) }}
                onClick={() => { setQuery(''); setDropdownOpen(true) }}
                placeholder="Search groups..."
                style={{ ...inputBase, paddingRight: 32, cursor: 'pointer' }}
                readOnly={!dropdownOpen}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <ChevronDownIcon />
              </span>
              {dropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 200, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
                      No groups available
                    </div>
                  ) : filtered.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setSelectedGroupId(g.id); setDropdownOpen(false); setQuery('') }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', textAlign: 'left', background: g.id === selectedGroupId ? '#F0F2FE' : 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = g.id === selectedGroupId ? '#F0F2FE' : 'none')}
                    >
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{g.name}</div>
                      {g.ministries && (
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF' }}>{g.ministries.name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Role</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['member', 'leader'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{ flex: 1, height: 38, borderRadius: 8, border: `0.5px solid ${role === r ? '#4F6BED' : 'var(--dm-border)'}`, background: role === r ? '#EEF0FD' : 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: role === r ? '#4F6BED' : 'var(--dm-text-secondary)', transition: 'all 0.12s' }}
              >
                {r === 'member' ? 'Member' : 'Leader'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedGroupId || saving}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: !selectedGroupId || saving ? '#818CF8' : '#4F6BED', cursor: !selectedGroupId || saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff', transition: 'background 0.15s' }}
          >
            {saving ? 'Assigning…' : 'Assign to Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Attendance Tab Component ─────────────────────────────────────────────────

interface AttRecord {
  id: string
  event_id: string
  present: boolean
  events: { id: string; name: string; event_type: string | null; starts_at: string } | null
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const ATT_TYPE_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  sunday_service:         { bg: '#E8ECF9', color: '#3349C7', dot: '#4F6BED', label: 'Sunday Service' },
  midweek_service:        { bg: '#EDE9FE', color: '#5B21B6', dot: '#8B5CF6', label: 'Midweek Service' },
  prayer_meeting:         { bg: '#F0FDFA', color: '#0F766E', dot: '#0D9488', label: 'Prayer Meeting' },
  youth_service:          { bg: '#FFF7ED', color: '#C2410C', dot: '#F97316', label: 'Youth Service' },
  special_programme:      { bg: '#FEF6E5', color: '#8A6418', dot: '#C8964A', label: 'Special Programme' },
  outreach:               { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'Outreach' },
  conference:             { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6', label: 'Conference' },
  funeral_burial_service: { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'Funeral/Burial' },
}

function getAttTypeStyle(type: string | null) {
  return ATT_TYPE_STYLES[type ?? ''] ?? { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: type ?? 'Event' }
}

function heatmapColor(count: number): string {
  if (count === 0) return '#E8ECF9'
  if (count === 1) return '#C4CEEB'
  if (count === 2) return '#8FA3E8'
  return '#4F6BED'
}

const ATT_PAGE = 10

function MemberAttendanceTab({ memberId }: { memberId: string }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState<AttRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    supabase
      .from('attendance')
      .select('id, event_id, present, events(id, name, event_type, starts_at)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecords((data ?? []) as unknown as AttRecord[])
        setLoading(false)
      })
  }, [memberId])

  const now = new Date()
  const currentYear = now.getFullYear()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const last3MonthsRecords = records.filter(r => r.events && new Date(r.events.starts_at) >= threeMonthsAgo)
  const last3MonthsPresent = last3MonthsRecords.filter(r => r.present).length
  const attendanceRate = last3MonthsRecords.length > 0
    ? Math.round((last3MonthsPresent / last3MonthsRecords.length) * 100)
    : 0

  const ytdTotal = records.filter(r => r.present && r.events && new Date(r.events.starts_at).getFullYear() === currentYear).length

  // Weekly streak: consecutive weeks going back from this week with ≥1 present record
  const presentRecords = records.filter(r => r.present && r.events)
  const presentWeeks = new Set(
    presentRecords.map(r => {
      const d = new Date(r.events!.starts_at)
      return `${d.getFullYear()}-${getWeekNumber(d)}`
    })
  )
  let streak = 0
  const cur = new Date()
  for (let w = 0; w < 52; w++) {
    const key = `${cur.getFullYear()}-${getWeekNumber(cur)}`
    if (presentWeeks.has(key)) { streak++ }
    else if (w > 0) break
    cur.setDate(cur.getDate() - 7)
  }

  // Heatmap: weeks of current year
  const startOfYear = new Date(currentYear, 0, 1)
  const weeksInYear = 52
  const countByWeek: Record<number, number> = {}
  for (const r of records) {
    if (!r.present || !r.events) continue
    const d = new Date(r.events.starts_at)
    if (d.getFullYear() !== currentYear) continue
    const wk = getWeekNumber(d)
    countByWeek[wk] = (countByWeek[wk] ?? 0) + 1
  }

  // History table
  const historyRecords = records.filter(r => r.events)
  const totalPages = Math.max(1, Math.ceil(historyRecords.length / ATT_PAGE))
  const paginated = historyRecords.slice((page - 1) * ATT_PAGE, page * ATT_PAGE)

  const statCardStyle: React.CSSProperties = {
    background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 10,
    padding: '14px 16px', flex: 1, position: 'relative', overflow: 'hidden',
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
      Loading attendance…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Attendance Rate</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{last3MonthsRecords.length === 0 ? '—' : `${attendanceRate}%`}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>last 3 months</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#4F6BED' }} />
        </div>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Current Streak</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{streak} <span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>wks</span></div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>consecutive weeks</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#22C55E' }} />
        </div>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Services YTD</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{ytdTotal}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>{currentYear} year-to-date</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#C8964A' }} />
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 12 }}>
          Attendance Heatmap — {currentYear}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: weeksInYear }, (_, i) => {
            const wk = i + 1
            const count = countByWeek[wk] ?? 0
            const startDay = new Date(startOfYear)
            startDay.setDate(startDay.getDate() + (wk - 1) * 7)
            const label = `Week ${wk}: ${count} service${count !== 1 ? 's' : ''} attended`
            return (
              <div
                key={wk}
                title={label}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: heatmapColor(count),
                  cursor: 'default',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF' }}>Less</span>
          {[0, 1, 2, 3].map(n => (
            <div key={n} style={{ width: 12, height: 12, borderRadius: 2, background: heatmapColor(n) }} />
          ))}
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF' }}>More</span>
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #F3F4F6' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>Attendance History</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Event', 'Type', 'Date', 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 18px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '0.5px solid #EFF1F7', background: '#FAFBFE', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No attendance records found.</td></tr>
            ) : paginated.map((r) => {
              if (!r.events) return null
              const ts = getAttTypeStyle(r.events.event_type)
              return (
                <tr key={r.id} onClick={() => navigate(`/events/${r.events!.id}`)} style={{ borderBottom: '0.5px solid #EFF1F7', height: 52, background: 'var(--dm-bg-card)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>
                  <td style={{ padding: '0 18px' }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{r.events.name}</div>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: ts.bg, color: ts.color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: ts.dot }} />
                      {ts.label}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#6B7280' }}>
                      {format(new Date(r.events.starts_at), 'MMM dd, yyyy')}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, background: r.present ? '#DCFCE7' : '#F3F4F6', color: r.present ? '#166534' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                      {r.present ? 'Present' : 'Absent'}
                    </span>
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    <button onClick={e => { e.stopPropagation(); navigate(`/events/${r.events!.id}`) }} style={{ width: 26, height: 26, borderRadius: 5, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {historyRecords.length > ATT_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280' }}>
              {Math.min((page - 1) * ATT_PAGE + 1, historyRecords.length)}–{Math.min(page * ATT_PAGE, historyRecords.length)} of {historyRecords.length}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--dm-text-muted)' : 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12 }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Groups Tab Component ─────────────────────────────────────────────────────

const GROUPS_PAGE = 10

function MemberGroupsTab({ memberId, orgId }: { memberId: string; orgId: string }) {
  const navigate = useNavigate()
  const [memberships, setMemberships] = useState<GroupMembershipFull[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  const fetchMemberships = async () => {
    const { data } = await supabase
      .from('group_memberships')
      .select('id, role, joined_at, left_at, is_active, groups(id, name, meeting_schedule, ministries(id, name))')
      .eq('member_id', memberId)
      .order('joined_at', { ascending: false })
    setMemberships((data ?? []) as unknown as GroupMembershipFull[])
    setLoading(false)
  }

  useEffect(() => { fetchMemberships() }, [memberId])

  const handleLeave = async (gmId: string) => {
    setLeavingId(gmId)
    await supabase
      .from('group_memberships')
      .update({ is_active: false, left_at: new Date().toISOString().split('T')[0] })
      .eq('id', gmId)
    toast.success('Left group')
    setConfirmLeaveId(null)
    setLeavingId(null)
    await fetchMemberships()
  }

  const active = memberships.filter(m => m.is_active)
  const past = memberships.filter(m => !m.is_active)
  const existingGroupIds = active.map(m => m.groups?.id ?? '').filter(Boolean)
  const leaderCount = active.filter(m => m.role === 'leader').length
  const totalPages = Math.max(1, Math.ceil(past.length / GROUPS_PAGE))
  const paginatedPast = past.slice((page - 1) * GROUPS_PAGE, page * GROUPS_PAGE)

  const statCardStyle: React.CSSProperties = {
    background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 10,
    padding: '14px 16px', flex: 1, position: 'relative', overflow: 'hidden',
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
      Loading groups…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showAssignModal && (
        <AssignToGroupModal
          memberId={memberId}
          orgId={orgId}
          existingGroupIds={existingGroupIds}
          onAssign={async () => { setShowAssignModal(false); await fetchMemberships() }}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowAssignModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#4F6BED', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3F5BD9')}
          onMouseLeave={e => (e.currentTarget.style.background = '#4F6BED')}
        >
          + Assign to Group
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Total Groups Joined</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{memberships.length}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>all time</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#4F6BED' }} />
        </div>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Active Groups</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{active.length}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>currently active</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#22C55E' }} />
        </div>
        <div style={statCardStyle}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Leadership Roles</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: '#111827', lineHeight: 1.1 }}>{leaderCount}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>group leader positions</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: '#C8964A' }} />
        </div>
      </div>

      {active.length === 0 ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
          Not a member of any active groups yet.
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 12 }}>
            Active Groups
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {active.map(gm => {
              const g = gm.groups
              if (!g) return null
              const schedule = parseMeetingSchedule(g.meeting_schedule)
              const isConfirming = confirmLeaveId === gm.id
              return (
                <div key={gm.id} style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 18 }}>
                  {g.ministries && (
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4F6BED', marginBottom: 6 }}>
                      {g.ministries.name}
                    </div>
                  )}
                  <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 8 }}>
                    {g.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: schedule ? 8 : 12 }}>
                    <span style={{ background: gm.role === 'leader' ? '#FFF8EC' : '#F3F4F6', color: gm.role === 'leader' ? '#C8964A' : '#6B7280', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>
                      {gm.role === 'leader' ? 'Leader' : 'Member'}
                    </span>
                    {gm.joined_at && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                        Joined {format(new Date(gm.joined_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {schedule && (
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                      {schedule.day} · {schedule.time}
                      {schedule.venue && <span style={{ color: '#9CA3AF' }}> · {schedule.venue}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => navigate(`/groups/${g.ministries?.id}/${g.id}`)}
                      style={{ flex: 1, height: 32, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F6BED')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                    >
                      View Group
                    </button>
                    {!isConfirming ? (
                      <button
                        onClick={() => setConfirmLeaveId(gm.id)}
                        style={{ height: 32, padding: '0 10px', borderRadius: 6, border: '0.5px solid #FCA5A5', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: '#EF4444', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
                      >
                        Leave
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setConfirmLeaveId(null)}
                          style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleLeave(gm.id)}
                          disabled={leavingId === gm.id}
                          style={{ height: 32, padding: '0 8px', borderRadius: 6, border: 'none', background: '#EF4444', cursor: leavingId === gm.id ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: '#fff' }}
                        >
                          {leavingId === gm.id ? '…' : 'Confirm'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>Past Memberships</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Group', 'Ministry', 'Role', 'Joined', 'Left'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 18px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '0.5px solid #EFF1F7', background: '#FAFBFE', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPast.map(gm => (
                <tr key={gm.id} style={{ borderBottom: '0.5px solid #EFF1F7', height: 48, background: 'var(--dm-bg-card)' }}>
                  <td style={{ padding: '0 18px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>
                    {gm.groups?.name ?? '—'}
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    {gm.groups?.ministries ? (
                      <span style={{ background: '#E8ECF9', color: '#4F6BED', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>
                        {gm.groups.ministries.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ background: gm.role === 'leader' ? '#FFF8EC' : '#F3F4F6', color: gm.role === 'leader' ? '#C8964A' : '#6B7280', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>
                      {gm.role === 'leader' ? 'Leader' : 'Member'}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#6B7280' }}>
                      {gm.joined_at ? format(new Date(gm.joined_at), 'MMM dd, yyyy') : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0 18px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: '#6B7280' }}>
                      {gm.left_at ? format(new Date(gm.left_at), 'MMM dd, yyyy') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {past.length > GROUPS_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: '0.5px solid #EFF1F7', background: '#FCFCFE' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280' }}>
                {Math.min((page - 1) * GROUPS_PAGE + 1, past.length)}–{Math.min(page * GROUPS_PAGE, past.length)} of {past.length}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12 }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12 }}>Next →</button>
            </div>
          )}
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'groups'>('overview')

  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null)
  const [removingRelId, setRemovingRelId] = useState<string | null>(null)
  const [showAddRel, setShowAddRel] = useState(false)

  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [sidebarGroups, setSidebarGroups] = useState<SidebarGroupMembership[]>([])
  const [sidebarGroupsLoading, setSidebarGroupsLoading] = useState(true)
  const [sidebarLeaveConfirmId, setSidebarLeaveConfirmId] = useState<string | null>(null)
  const [sidebarLeaving, setSidebarLeaving] = useState(false)

  const fetchMember = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        branches(id, name),
        group_memberships(
          id, role, joined_at,
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

  const fetchTransactions = async () => {
    if (!id || !user) return
    const currentYear = new Date().getFullYear()
    const startOfYear = `${currentYear}-01-01`
    const { data } = await supabase
      .from('transactions')
      .select('amount, transaction_date')
      .eq('member_id', id)
      .eq('org_id', user.org_id)
      .gte('transaction_date', startOfYear)
      .order('transaction_date', { ascending: false })
    setTransactions((data ?? []) as Transaction[])
  }

  const fetchSidebarGroups = async () => {
    if (!id) return
    setSidebarGroupsLoading(true)
    const { data } = await supabase
      .from('group_memberships')
      .select('id, role, joined_at, groups(id, name, meeting_schedule, ministries(id, name))')
      .eq('member_id', id)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })
    setSidebarGroups((data ?? []) as unknown as SidebarGroupMembership[])
    setSidebarGroupsLoading(false)
  }

  const handleSidebarLeave = async (gmId: string) => {
    setSidebarLeaving(true)
    await supabase
      .from('group_memberships')
      .update({ is_active: false, left_at: new Date().toISOString().split('T')[0] })
      .eq('id', gmId)
    toast.success('Left group')
    setSidebarLeaveConfirmId(null)
    setSidebarLeaving(false)
    await fetchSidebarGroups()
    await fetchMember()
  }

  useEffect(() => {
    fetchMember()
    fetchSidebarGroups()
  }, [id])

  useEffect(() => {
    if (user) {
      fetchRelationships()
      fetchTransactions()
    }
  }, [id, user])

  const handleRemoveRelationship = async (relId: string) => {
    setRemovingRelId(relId)
    await supabase.from('member_relationships').delete().eq('id', relId)
    await fetchRelationships()
    setRemovingRelId(null)
  }

  const handleMessage = () => {
    if (!member?.email) {
      toast.info('No email address on file')
      return
    }
    window.location.href = `mailto:${member.email}`
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

  const memberSinceDisplay = member.membership_date
    ? format(new Date(member.membership_date), 'MMM yyyy')
    : null

  const initials = `${member.first_name[0] ?? ''}${member.last_name[0] ?? ''}`.toUpperCase()
  const avatarColors = getAvatarColor(member.first_name, member.last_name)

  // Giving summary
  const ytdTotal = transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  const lastGift = transactions[0] ?? null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/members')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 6, transition: 'color 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
          >
            <BackArrowIcon />
          </button>

          {/* Large avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: avatarColors.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 18, color: avatarColors.color,
            }}>
              {initials}
            </span>
          </div>

          <div>
            <h1 style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 20, color: '#111827',
              letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2,
            }}>
              {member.first_name} {member.last_name}
            </h1>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13, color: '#9CA3AF', marginTop: 3,
            }}>
              {member.member_number ?? '—'}
              {memberSinceDisplay && (
                <span> · Member since {memberSinceDisplay}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={member.membership_status} />

          {/* Message button */}
          <button
            onClick={handleMessage}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 38, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
              cursor: 'pointer', color: 'var(--dm-text-body)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F6BED')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <EnvelopeIcon /> Message
          </button>

          <button
            onClick={() => navigate(`/members/${member.id}/edit`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 38, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
              cursor: 'pointer', color: 'var(--dm-text-body)',
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

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 24 }}>
        {[
          { key: 'overview' as const, label: 'Overview' },
          { key: 'attendance' as const, label: 'Attendance' },
          { key: 'groups' as const, label: 'Groups' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 14px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13,
              color: activeTab === tab.key ? '#4F6BED' : '#6B7280',
              borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent',
              marginBottom: -1, background: 'none', cursor: 'pointer', transition: 'color 0.12s',
            }}
            onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#6B7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'attendance' && <MemberAttendanceTab memberId={member.id} />}
      {activeTab === 'groups' && <MemberGroupsTab memberId={member.id} orgId={member.org_id} />}

      {/* Two Column Layout */}
      {activeTab === 'overview' && <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

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
            {sidebarGroupsLoading ? (
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', padding: '8px 0' }}>
                Loading…
              </div>
            ) : sidebarGroups.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                Not assigned to any groups yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sidebarGroups.map(gm => {
                  const g = gm.groups
                  const ministryId = g?.ministries?.id
                  const groupId = g?.id
                  const isConfirming = sidebarLeaveConfirmId === gm.id
                  return (
                    <div key={gm.id} style={{ border: '0.5px solid #E8ECF9', borderRadius: 8, padding: '10px 12px', background: '#FAFBFF' }}>
                      {g?.ministries && (
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, color: '#4F6BED', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                          {g.ministries.name}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>
                          {g?.name ?? '—'}
                        </span>
                        <span style={{ background: gm.role === 'leader' ? '#FFF8EC' : '#F3F4F6', color: gm.role === 'leader' ? '#C8964A' : '#6B7280', borderRadius: 5, padding: '2px 7px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, flexShrink: 0 }}>
                          {capitalize(gm.role)}
                        </span>
                      </div>
                      {g?.meeting_schedule && (
                        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', marginBottom: 3 }}>
                          {g.meeting_schedule}
                        </div>
                      )}
                      {gm.joined_at && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
                          Joined {format(new Date(gm.joined_at), 'MMM d, yyyy')}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {ministryId && groupId && (
                          <button
                            type="button"
                            onClick={() => navigate(`/groups/${ministryId}/${groupId}`)}
                            style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid #C7D2FB', background: '#E8ECF9', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, color: '#4F6BED' }}
                          >
                            View Group
                          </button>
                        )}
                        {isConfirming ? (
                          <>
                            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center' }}>Leave?</span>
                            <button
                              type="button"
                              disabled={sidebarLeaving}
                              onClick={() => handleSidebarLeave(gm.id)}
                              style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid #FECACA', background: '#FEF2F2', cursor: sidebarLeaving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, color: '#DC2626' }}
                            >
                              {sidebarLeaving ? 'Leaving…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSidebarLeaveConfirmId(null)}
                              style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, color: 'var(--dm-text-secondary)' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSidebarLeaveConfirmId(gm.id)}
                            style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, color: '#6B7280' }}
                          >
                            Leave Group
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
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
                background: 'var(--dm-bg-card)', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: '#4F6BED',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F2FE')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
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

          {/* Giving Summary */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Giving Summary</div>

            {transactions.length === 0 ? (
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#9CA3AF',
                marginBottom: 12,
              }}>
                No giving records yet.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, fontSize: 11, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                  }}>
                    Total Given (YTD)
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 16, color: '#111827', fontWeight: 500,
                  }}>
                    {formatAmount(ytdTotal)}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, fontSize: 11, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                  }}>
                    Last Gift
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13, color: '#374151',
                  }}>
                    {lastGift
                      ? `${formatAmount(lastGift.amount)} on ${format(new Date(lastGift.transaction_date), 'MMM d, yyyy')}`
                      : '—'}
                  </div>
                </div>
              </>
            )}

            <a
              href={`/donations?member_id=${member.id}`}
              onClick={e => { e.preventDefault(); navigate(`/donations?member_id=${member.id}`) }}
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#4F6BED', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              View giving history →
            </a>
          </div>

          {/* Quick Actions */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Actions</div>

            <button
              onClick={() => navigate(`/members/${member.id}/edit`)}
              style={{
                display: 'block', width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid var(--dm-border)',
                background: 'var(--dm-bg-card)', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
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
                  background: 'var(--dm-bg-card)',
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
                  background: 'var(--dm-bg-card)',
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
      </div>}
    </>
  )
}

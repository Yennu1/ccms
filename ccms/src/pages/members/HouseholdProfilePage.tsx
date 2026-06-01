import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'active' | 'inactive' | 'transferred' | 'deceased'

interface HouseholdMember {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
  membership_status: MemberStatus
}

interface Household {
  id: string
  org_id: string
  name: string
  address: string | null
  notes: string | null
  created_at: string
  branches: { id: string; name: string } | null
  head_member: { id: string; first_name: string; last_name: string; member_number: string | null } | null
  members: HouseholdMember[] | null
}

interface MemberOption {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<MemberStatus, { bg: string; color: string; label: string }> = {
  active:      { bg: '#DCFCE7', color: '#166534', label: 'Active' },
  inactive:    { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive' },
  transferred: { bg: '#EEF2FF', color: '#4338CA', label: 'Transferred' },
  deceased:    { bg: '#FEE2E2', color: '#991B1B', label: 'Deceased' },
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), 'MMM dd, yyyy') } catch { return '—' }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function HouseIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M4 22L24 6l20 16" stroke="#E5E7EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 19v22a1 1 0 0 0 1 1h30a1 1 0 0 0 1-1V19" stroke="#E5E7EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="30" width="10" height="12" rx="1" stroke="#E5E7EB" strokeWidth="2" />
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

function Avatar({ firstName, lastName, size = 36 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--dm-bg-tint)', color: '#4F6BED',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      fontWeight: 600, fontSize: Math.floor(size * 0.34),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: string | undefined }) {
  const s = STATUS_STYLES[status?.toLowerCase() as MemberStatus]
    ?? { bg: '#F3F4F6', color: '#6B7280', label: status ?? 'Unknown' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 5, padding: '2px 8px',
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

function SkeletonBar({ width, height = 14 }: { width: number | string; height?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 4,
      background: 'var(--dm-bg-muted)',
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

function LoadingSkeleton() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <SkeletonBar width={220} height={24} />
        <SkeletonBar width={100} height={36} />
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <SkeletonBar width={160} height={14} />
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[100, 140, 80, 120].map((w, i) => (
                <div key={i}>
                  <SkeletonBar width={60} height={10} />
                  <div style={{ marginTop: 6 }}><SkeletonBar width={w} height={14} /></div>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <SkeletonBar width={100} height={14} />
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <SkeletonBar key={i} width="100%" height={44} />)}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <SkeletonBar width={140} height={14} />
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--dm-bg-muted)' }} />
              <div>
                <SkeletonBar width={120} height={14} />
                <div style={{ marginTop: 6 }}><SkeletonBar width={80} height={11} /></div>
              </div>
            </div>
          </div>
          <div style={cardStyle}>
            <SkeletonBar width={100} height={14} />
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBar width="100%" height={36} />
              <SkeletonBar width="100%" height={36} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 0', gap: 8,
    }}>
      <div style={{ color: '#E5E7EB' }}><HouseIcon /></div>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 600, fontSize: 18, color: 'var(--dm-text-ink)',
      }}>
        Household not found
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 13, color: 'var(--dm-text-secondary)',
      }}>
        This household may have been removed.
      </div>
      <button
        onClick={() => navigate('/households')}
        style={{
          marginTop: 8, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: '#4F6BED',
        }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        Back to Households
      </button>
    </div>
  )
}

// ─── Member Search Select (for modals) ───────────────────────────────────────

function MemberSearchSelect({
  members,
  value,
  onChange,
  placeholder,
}: {
  members: MemberOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
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

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
    outline: 'none', padding: '0 32px 0 10px', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    cursor: 'pointer',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : displayText}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onClick={() => { setQuery(''); setOpen(true) }}
        placeholder={placeholder ?? 'Search members...'}
        style={inputStyle}
        readOnly={!open}
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
          background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 200, maxHeight: 200, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '10px 12px',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13, color: 'var(--dm-text-muted)',
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
                  background: m.id === value ? 'var(--dm-bg-tint)' : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '8px 12px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = m.id === value ? 'var(--dm-bg-tint)' : 'none')}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--dm-bg-tint)', color: '#4F6BED',
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
                    fontWeight: 500, fontSize: 13, color: 'var(--dm-text-ink)',
                  }}>
                    {m.first_name} {m.last_name}
                  </div>
                  {m.member_number && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11, color: 'var(--dm-text-muted)',
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

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  householdId,
  orgId,
  existingMemberIds,
  onAdd,
  onClose,
}: {
  householdId: string
  orgId: string
  existingMemberIds: string[]
  onAdd: () => void
  onClose: () => void
}) {
  const [availableMembers, setAvailableMembers] = useState<MemberOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('members')
      .select('id, first_name, last_name, member_number')
      .eq('org_id', orgId)
      .eq('membership_status', 'active')
      .is('household_id', null)
      .order('first_name')
      .then(({ data }) => {
        if (data) {
          setAvailableMembers(
            (data as MemberOption[]).filter(m => !existingMemberIds.includes(m.id))
          )
        }
        setLoading(false)
      })
  }, [orgId, existingMemberIds])

  const handleAdd = async () => {
    if (!selectedId) return
    setSaving(true)
    const { error } = await supabase
      .from('members')
      .update({ household_id: householdId })
      .eq('id', selectedId)
    if (error) {
      toast.error('Failed to add member')
    } else {
      toast.success('Member added to household')
      onAdd()
    }
    setSaving(false)
  }

  return (
    <div style={{
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
          Add Member to Household
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20,
        }}>
          Select an active member without an existing household assignment.
        </div>

        {loading ? (
          <div style={{
            height: 38, background: 'var(--dm-bg-muted)', borderRadius: 8,
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
        ) : availableMembers.length === 0 ? (
          <div style={{
            height: 38, display: 'flex', alignItems: 'center',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: 'var(--dm-text-muted)',
          }}>
            No available members to add.
          </div>
        ) : (
          <MemberSearchSelect
            members={availableMembers}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Search active members..."
          />
        )}

        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          marginTop: 20,
        }}>
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
            onClick={handleAdd}
            disabled={!selectedId || saving}
            style={{
              height: 36, padding: '0 16px', borderRadius: 8,
              border: 'none',
              background: !selectedId || saving ? '#818CF8' : '#4F6BED',
              cursor: !selectedId || saving ? 'not-allowed' : 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#fff',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Head Modal ────────────────────────────────────────────────────────

function AssignHeadModal({
  household,
  onAssign,
  onClose,
}: {
  household: Household
  onAssign: () => void
  onClose: () => void
}) {
  const householdMembers: MemberOption[] = (household.members ?? []).map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    member_number: m.member_number,
  }))
  const [selectedId, setSelectedId] = useState(household.head_member?.id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('households')
      .update({ head_member_id: selectedId || null })
      .eq('id', household.id)
    if (error) {
      toast.error('Failed to update head of household')
    } else {
      toast.success('Head of household updated')
      onAssign()
    }
    setSaving(false)
  }

  return (
    <div style={{
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
          {household.head_member ? 'Change Head of Household' : 'Assign Head of Household'}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20,
        }}>
          Select a member from this household to be the head.
        </div>

        {householdMembers.length === 0 ? (
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: 'var(--dm-text-muted)',
          }}>
            Add members to this household first.
          </div>
        ) : (
          <MemberSearchSelect
            members={householdMembers}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Select head of household..."
          />
        )}

        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          marginTop: 20,
        }}>
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
            onClick={handleSave}
            disabled={saving || householdMembers.length === 0}
            style={{
              height: 36, padding: '0 16px', borderRadius: 8,
              border: 'none',
              background: saving ? '#818CF8' : '#4F6BED',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13, color: '#fff',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HouseholdProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAssignHead, setShowAssignHead] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fetchHousehold = async () => {
    if (!id || !user) return

    const { data, error } = await supabase
      .from('households')
      .select(`
        *,
        branches(id, name),
        head_member:members!households_head_member_id_fkey(
          id, first_name, last_name, member_number
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const { data: householdMembers } = await supabase
      .from('members')
      .select('id, first_name, last_name, member_number, membership_status')
      .eq('household_id', id)
      .eq('org_id', user.org_id)

    setHousehold({ ...data, members: householdMembers ?? [] } as unknown as Household)
    setLoading(false)
  }

  useEffect(() => {
    fetchHousehold()
  }, [id])

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId)
    const { error } = await supabase
      .from('members')
      .update({ household_id: null })
      .eq('id', memberId)
    if (error) {
      toast.error('Failed to remove member')
    } else {
      toast.success('Member removed from household')
      await fetchHousehold()
    }
    setRemovingId(null)
  }

  const handleDelete = async () => {
    if (!household) return
    setDeleting(true)
    await supabase.from('members').update({ household_id: null }).eq('household_id', household.id)
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    if (error) {
      toast.error('Failed to delete household')
      setDeleting(false)
      setShowDeleteConfirm(false)
    } else {
      toast.success('Household deleted')
      navigate('/households')
    }
  }

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <LoadingSkeleton />
      </>
    )
  }

  if (notFound || !household) {
    return <NotFound />
  }

  const memberIds = (household.members ?? []).map(m => m.id)

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Add Member Modal */}
      {showAddMember && user && (
        <AddMemberModal
          householdId={household.id}
          orgId={user.org_id}
          existingMemberIds={memberIds}
          onAdd={async () => { setShowAddMember(false); await fetchHousehold() }}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Assign Head Modal */}
      {showAssignHead && (
        <AssignHeadModal
          household={household}
          onAssign={async () => { setShowAssignHead(false); await fetchHousehold() }}
          onClose={() => setShowAssignHead(false)}
        />
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/households')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--dm-text-secondary)', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-secondary)')}
          >
            <BackArrowIcon />
          </button>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 20, color: 'var(--dm-text-ink)',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            {household.name}
          </h1>
        </div>

        <button
          onClick={() => navigate(`/households/${household.id}/edit`)}
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
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dm-border)')}
        >
          Edit
        </button>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Household Details */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Household Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <Field label="Name">{household.name}</Field>
              <Field label="Branch">{household.branches?.name ?? '—'}</Field>
              <Field label="Address">{household.address ?? '—'}</Field>
              <Field label="Created">{formatDate(household.created_at)}</Field>
            </div>
          </div>

          {/* Members */}
          <div style={cardStyle}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, paddingBottom: 12, borderBottom: '0.5px solid var(--dm-border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)',
                }}>
                  Members
                </span>
                <span style={{
                  background: 'var(--dm-bg-tint)', color: '#4F6BED',
                  borderRadius: 5, padding: '2px 8px',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500, fontSize: 12,
                }}>
                  {household.members?.length ?? 0}
                </span>
              </div>
            </div>

            {(!household.members || household.members.length === 0) ? (
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: 'var(--dm-text-muted)',
                textAlign: 'center', padding: '24px 0',
              }}>
                No members assigned yet
              </div>
            ) : (
              <div>
                {household.members.map((member, i) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: i < (household.members!.length - 1) ? '0.5px solid var(--dm-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar firstName={member.first_name} lastName={member.last_name} />
                      <div>
                        <div style={{
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 500, fontSize: 14, color: 'var(--dm-text-ink)',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          {member.first_name} {member.last_name}
                          {household.head_member?.id === member.id && (
                            <span style={{
                              background: '#FFF8EC', color: '#C8964A',
                              borderRadius: 5, padding: '1px 6px',
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontWeight: 500, fontSize: 10,
                            }}>
                              Head
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {member.member_number && (
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: 11, color: 'var(--dm-text-muted)',
                            }}>
                              {member.member_number}
                            </span>
                          )}
                          <StatusBadge status={member.membership_status} />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingId === member.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontSize: 12, color: '#EF4444', padding: '4px 8px',
                        borderRadius: 6, opacity: removingId === member.id ? 0.5 : 1,
                        transition: 'background 0.1s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {removingId === member.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddMember(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginTop: 16, background: 'none',
                border: '0.5px dashed var(--dm-border-strong)', borderRadius: 8,
                cursor: 'pointer', width: '100%',
                height: 38, justifyContent: 'center',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: 'var(--dm-text-secondary)',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#4F6BED'
                e.currentTarget.style.color = '#4F6BED'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--dm-border-strong)'
                e.currentTarget.style.color = 'var(--dm-text-secondary)'
              }}
            >
              <PlusIcon /> Add Member to Household
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Head of Household */}
          <div style={cardStyle}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, paddingBottom: 12, borderBottom: '0.5px solid var(--dm-border-subtle)',
            }}>
              <div style={{ ...cardHeaderStyle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                Head of Household
              </div>
              {household.head_member && (
                <button
                  onClick={() => setShowAssignHead(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontSize: 13, color: '#4F6BED', padding: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Change
                </button>
              )}
            </div>

            {household.head_member ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  firstName={household.head_member.first_name}
                  lastName={household.head_member.last_name}
                  size={40}
                />
                <div>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, fontSize: 14, color: 'var(--dm-text-ink)',
                  }}>
                    {household.head_member.first_name} {household.head_member.last_name}
                  </div>
                  {household.head_member.member_number && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12, color: 'var(--dm-text-muted)', marginTop: 2,
                    }}>
                      {household.head_member.member_number}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13, color: 'var(--dm-text-muted)', marginBottom: 12,
                }}>
                  No head assigned
                </div>
                <button
                  onClick={() => setShowAssignHead(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 34, padding: '0 12px', borderRadius: 8,
                    border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F6BED')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dm-border)')}
                >
                  <PlusIcon /> Assign Head
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>Quick Actions</div>

            <button
              onClick={() => navigate(`/households/${household.id}/edit`)}
              style={{
                display: 'block', width: '100%', height: 38,
                borderRadius: 8, border: '0.5px solid var(--dm-border)',
                background: 'var(--dm-bg-card)', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
                marginBottom: 8, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dm-border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dm-border)')}
            >
              Edit Household
            </button>

            <div style={{ height: '0.5px', background: 'var(--dm-border-subtle)', margin: '8px 0' }} />

            {showDeleteConfirm ? (
              <div style={{
                background: '#FEF2F2', border: '0.5px solid #FECACA',
                borderRadius: 8, padding: 12,
              }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 13, color: '#991B1B', marginBottom: 10,
                }}>
                  Delete this household? All members will be unassigned.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      flex: 1, height: 34, borderRadius: 8,
                      border: 'none', background: '#EF4444',
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 13, color: '#fff',
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      flex: 1, height: 34, borderRadius: 8,
                      border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
                      cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  display: 'block', width: '100%', height: 38,
                  borderRadius: 8, border: '0.5px solid #FCA5A5',
                  background: 'var(--dm-bg-card)', cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500, fontSize: 13, color: '#EF4444',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
              >
                Delete Household
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format, startOfMonth } from 'date-fns'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MemberAvatar } from '../../components/MemberAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupTab = 'members' | 'settings'

interface Group {
  id: string; org_id: string; name: string; description: string | null
  is_active: boolean; meeting_schedule: string | null; leader_id: string | null
  ministry_id: string | null
  ministries: { id: string; name: string } | null
  leader: { id: string; first_name: string; last_name: string; member_number: string | null } | null
}

interface GroupMember {
  id: string; role: string; joined_at: string | null; is_active: boolean
  member: { id: string; first_name: string; last_name: string; member_number: string | null; membership_status: string; photo_url: string | null } | null
}

interface MemberOption { id: string; first_name: string; last_name: string; member_number: string | null }
interface Ministry { id: string; name: string }
interface GroupSchedule { id: string; group_id: string; meeting_day: string; meeting_time: string; meeting_venue: string | null }
interface ScheduleEntry { localId: string; day: string; time: string; venue: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { bg: '#E8ECF9', color: '#4F6BED' }, { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' }, { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' }, { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F0FDFA', color: '#0F766E' }, { bg: '#F5F3FF', color: '#7C3AED' },
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatScheduleTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg> }
function DownloadIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3v8M5 8l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronDownIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function SlashIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M5 14L11 2" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" /></svg> }
function ArrowRightIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function PencilIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg> }

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--dm-text-ink)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)', marginTop: 4 }}>{sub}</div>}
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
    </div>
  )
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({ group, existingMemberIds, orgId, onAdd, onClose }: {
  group: Group; existingMemberIds: string[]; orgId: string; onAdd: () => void; onClose: () => void
}) {
  const [allMembers, setAllMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [role, setRole] = useState<'member' | 'leader'>('member')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('members').select('id, first_name, last_name, member_number').eq('org_id', orgId).order('first_name')
      .then(({ data }) => { if (data) setAllMembers(data as MemberOption[]); setLoading(false) })
  }, [orgId])

  const available = allMembers.filter(m => {
    if (existingMemberIds.includes(m.id)) return false
    const q = query.toLowerCase()
    return !q || m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || (m.member_number ?? '').toLowerCase().includes(q)
  })

  const selected = allMembers.find(m => m.id === selectedId)

  const handleAdd = async () => {
    if (!selectedId) return
    setSaving(true)
    const { error } = await supabase.from('group_memberships').insert({
      org_id: orgId,
      group_id: group.id,
      member_id: selectedId,
      role,
      joined_at: new Date().toISOString().split('T')[0],
      is_active: true,
    })
    if (error) { toast.error('Failed to add member: ' + error.message); setSaving(false); return }
    toast.success('Member added to group')
    onAdd()
  }

  const inputBase: React.CSSProperties = { width: '100%', height: 38, borderRadius: 8, border: '0.5px solid var(--dm-border)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none', padding: '0 12px', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--dm-bg-card)', borderRadius: 12, border: '0.5px solid var(--dm-border)', padding: 24, width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 6 }}>Add Member to Group</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 18 }}>Search for an org member not already in <strong style={{ color: 'var(--dm-text-ink)' }}>{group.name}</strong>.</div>

        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' }}><SearchIcon /></span>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members…" style={{ ...inputBase, paddingLeft: 34 }} autoFocus />
        </div>

        {/* Member List */}
        <div style={{ flex: 1, overflowY: 'auto', border: '0.5px solid var(--dm-border)', borderRadius: 8, marginBottom: 16, minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>Loading…</div>
          ) : available.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>{query ? 'No members match your search' : 'All members are already in this group'}</div>
          ) : available.map(m => {
            const { bg, color } = avatarColor(m.first_name + m.last_name)
            return (
              <button key={m.id} type="button" onClick={() => setSelectedId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: m.id === selectedId ? '#EEF1FD' : 'none', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6', transition: 'background 0.1s' }} onMouseEnter={e => { if (m.id !== selectedId) e.currentTarget.style.background = '#F9FAFB' }} onMouseLeave={e => { if (m.id !== selectedId) e.currentTarget.style.background = 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.first_name[0]}{m.last_name[0]}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{m.first_name} {m.last_name}</div>
                  {m.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>}
                </div>
                {m.id === selectedId && <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: '#4F6BED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
              </button>
            )
          })}
        </div>

        {/* Role Selection */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: '#374151', marginBottom: 8 }}>Role</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['member', 'leader'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${role === r ? '#4F6BED' : 'var(--dm-border)'}`, background: role === r ? '#EEF1FD' : 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: role === r ? '#4F6BED' : 'var(--dm-text-body)', textTransform: 'capitalize' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>Cancel</button>
          <button onClick={handleAdd} disabled={!selectedId || saving} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: !selectedId || saving ? '#818CF8' : '#4F6BED', cursor: !selectedId || saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff' }}>
            {saving ? 'Adding…' : `Add ${selected ? selected.first_name : 'Member'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Schedule Builder ─────────────────────────────────────────────────────────

function ScheduleBuilder({ entries, onChange, disabled = false }: {
  entries: ScheduleEntry[]
  onChange: (entries: ScheduleEntry[]) => void
  disabled?: boolean
}) {
  const inputSt: React.CSSProperties = {
    width: '100%', height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)',
    background: 'var(--dm-bg-card)', outline: 'none', padding: '0 10px', boxSizing: 'border-box',
    opacity: disabled ? 0.6 : 1,
  }

  const update = (id: string, field: keyof Omit<ScheduleEntry, 'localId'>, value: string) => {
    if (disabled) return
    onChange(entries.map(e => e.localId === id ? { ...e, [field]: value } : e))
  }

  const add = () => {
    if (disabled) return
    onChange([...entries, { localId: `${Date.now()}`, day: '', time: '', venue: '' }])
  }

  return (
    <div>
      {entries.map((entry, i) => (
        <div key={entry.localId} style={{ background: 'var(--dm-bg-muted)', border: '0.5px solid var(--dm-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{entries.length > 1 ? `Schedule ${i + 1}` : 'Schedule'}</span>
            {entries.length > 1 && !disabled && (
              <button type="button" onClick={() => onChange(entries.filter(e => e.localId !== entry.localId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 17, lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center' }} onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>×</button>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Meeting Day</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DAYS.map(day => {
                const active = entry.day === day
                return (
                  <button key={day} type="button" disabled={disabled} onClick={() => update(entry.localId, 'day', active ? '' : day)} style={{ height: 28, padding: '0 10px', borderRadius: 999, border: `1.5px solid ${active ? '#4F6BED' : 'var(--dm-border)'}`, background: active ? '#EEF1FD' : 'var(--dm-bg-card)', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: active ? 600 : 500, fontSize: 12, color: active ? '#4F6BED' : 'var(--dm-text-body)', opacity: disabled ? 0.6 : 1 }}>{day.slice(0, 3)}</button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Time</div>
              <input type="time" value={entry.time} disabled={disabled} onChange={e => update(entry.localId, 'time', e.target.value)} style={inputSt} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Venue <span style={{ color: '#9CA3AF' }}>(optional)</span></div>
              <input type="text" value={entry.venue} disabled={disabled} onChange={e => update(entry.localId, 'venue', e.target.value)} placeholder="e.g. Fellowship Hall" style={inputSt} />
            </div>
          </div>
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={add} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: '#4F6BED', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#EEF1FD')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>
          + Add Another Meeting Time
        </button>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function GroupSettingsTab({ group, ministries, members, canManage, onSaved, initialSchedules }: {
  group: Group; ministries: Ministry[]; members: MemberOption[]; canManage: boolean; onSaved: () => void
  initialSchedules: GroupSchedule[]
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(() =>
    initialSchedules.length > 0
      ? initialSchedules.map(s => ({ localId: s.id, day: s.meeting_day, time: s.meeting_time.slice(0, 5), venue: s.meeting_venue ?? '' }))
      : [{ localId: 'init', day: '', time: '', venue: '' }]
  )
  const [leaderId, setLeaderId] = useState(group.leader_id ?? '')
  const [ministryId, setMinistryId] = useState(group.ministry_id ?? '')
  const [isActive, setIsActive] = useState(group.is_active)
  const [saving, setSaving] = useState(false)
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderOpen, setLeaderOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const leaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (leaderRef.current && !leaderRef.current.contains(e.target as Node)) setLeaderOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedLeader = members.find(m => m.id === leaderId)
  const leaderText = selectedLeader ? `${selectedLeader.first_name} ${selectedLeader.last_name}` : ''
  const filteredMembers = members.filter(m => {
    const q = leaderQuery.toLowerCase()
    return !q || m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q)
  })

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('groups').update({
      name: name.trim(), description: description.trim() || null,
      leader_id: leaderId || null, meeting_schedule: null,
      ministry_id: ministryId || null, is_active: isActive,
    }).eq('id', group.id)
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    await supabase.from('group_schedules').delete().eq('group_id', group.id)
    const validEntries = scheduleEntries.filter(s => s.day && s.time)
    if (validEntries.length > 0) {
      await supabase.from('group_schedules').insert(
        validEntries.map(s => ({ group_id: group.id, meeting_day: s.day, meeting_time: s.time, meeting_venue: s.venue || null }))
      )
    }
    toast.success('Group updated')
    setSaving(false); onSaved()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('group_schedules').delete().eq('group_id', group.id)
    await supabase.from('group_memberships').delete().eq('group_id', group.id)
    await supabase.from('groups').delete().eq('id', group.id)
    toast.success('Group deleted')
    navigate(`/groups/${group.ministry_id ?? ''}`)
  }

  const inputBase: React.CSSProperties = { width: '100%', height: 38, borderRadius: 8, border: '0.5px solid var(--dm-border)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none', padding: '0 12px', boxSizing: 'border-box' }
  const labelSt: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)', display: 'block', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 20, paddingBottom: 12, borderBottom: '0.5px solid var(--dm-border-subtle)' }}>Edit Group</div>
        <div style={{ marginBottom: 16 }}><label style={labelSt}>Group Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!canManage} style={{ ...inputBase, opacity: canManage ? 1 : 0.6 }} /></div>
        <div style={{ marginBottom: 16 }}><label style={labelSt}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} disabled={!canManage} rows={3} style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5, opacity: canManage ? 1 : 0.6 }} /></div>

        {/* Leader */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Group Leader</label>
          <div ref={leaderRef} style={{ position: 'relative' }}>
            <input type="text" value={leaderOpen ? leaderQuery : leaderText} onChange={e => { setLeaderQuery(e.target.value); setLeaderOpen(true) }} onFocus={() => { setLeaderQuery(''); setLeaderOpen(true) }} placeholder="Search members…" disabled={!canManage} style={{ ...inputBase, paddingRight: 32, cursor: 'pointer', opacity: canManage ? 1 : 0.6 }} readOnly={!leaderOpen} />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><ChevronDownIcon /></span>
            {leaderOpen && canManage && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                {leaderId && <button type="button" onClick={() => { setLeaderId(''); setLeaderOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Clear leader</button>}
                {filteredMembers.map(m => {
                  const { bg, color } = avatarColor(m.first_name + m.last_name)
                  return (
                    <button type="button" key={m.id} onClick={() => { setLeaderId(m.id); setLeaderOpen(false); setLeaderQuery('') }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: m.id === leaderId ? '#F0F2FE' : 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = m.id === leaderId ? '#F0F2FE' : 'none')}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.first_name[0]}{m.last_name[0]}</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{m.first_name} {m.last_name}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Meeting Schedule */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Meeting Schedule</label>
          <ScheduleBuilder entries={scheduleEntries} onChange={setScheduleEntries} disabled={!canManage} />
        </div>

        {/* Transfer Ministry */}
        {canManage && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Ministry</label>
            <div style={{ position: 'relative' }}>
              <select value={ministryId} onChange={e => setMinistryId(e.target.value)} style={{ ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer', color: ministryId ? '#111827' : '#9CA3AF' }}>
                <option value="">No ministry</option>
                {ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><ChevronDownIcon /></span>
            </div>
          </div>
        )}

        {/* Status */}
        <div style={{ marginBottom: canManage ? 16 : 0 }}>
          <label style={labelSt}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(opt => (
              <button key={String(opt.v)} type="button" disabled={!canManage} onClick={() => setIsActive(opt.v)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isActive === opt.v ? '#4F6BED' : 'var(--dm-border)'}`, background: isActive === opt.v ? '#EEF1FD' : 'var(--dm-bg-card)', cursor: canManage ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isActive === opt.v ? '#4F6BED' : 'var(--dm-text-body)', opacity: canManage ? 1 : 0.6 }}>{opt.l}</button>
            ))}
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: saving ? '#818CF8' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        )}
      </div>

      {canManage && (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid #FCA5A5', borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#EF4444', marginBottom: 8 }}>Danger Zone</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 14 }}>Deleting this group will remove all member records from the group.</div>
          {!showDeleteConfirm
            ? <button onClick={() => setShowDeleteConfirm(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid #FCA5A5', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>Delete Group</button>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)' }}>Are you sure?</span>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#fff' }}>{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
            </div>
          }
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { ministryId, groupId } = useParams<{ ministryId: string; groupId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [schedules, setSchedules] = useState<GroupSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<GroupTab>('members')
  const [memberSearch, setMemberSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [newThisMonth, setNewThisMonth] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const canManage = user?.role === 'super_admin' || user?.role === 'pastor'
  const isGroupLeader = user?.role === 'group_leader'

  const fetchGroup = useCallback(async () => {
    if (!groupId) return
    const { data, error } = await supabase
      .from('groups')
      .select('*, ministries(id, name), leader:members!groups_leader_id_fkey(id, first_name, last_name, member_number)')
      .eq('id', groupId)
      .single()
    if (error || !data) { setNotFound(true); setLoading(false); return }
    setGroup(data as unknown as Group)
    setLoading(false)
  }, [groupId])

  const fetchMembers = useCallback(async () => {
    if (!groupId) return
    const { data } = await supabase
      .from('group_memberships')
      .select('id, role, joined_at, is_active, member:members!group_memberships_member_id_fkey(id, first_name, last_name, member_number, membership_status, photo_url)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })
    setMembers((data ?? []) as unknown as GroupMember[])
  }, [groupId])

  const fetchSchedules = useCallback(async () => {
    if (!groupId) return
    const { data } = await supabase
      .from('group_schedules')
      .select('id, group_id, meeting_day, meeting_time, meeting_venue')
      .eq('group_id', groupId)
      .order('meeting_day')
    setSchedules((data ?? []) as GroupSchedule[])
  }, [groupId])

  useEffect(() => { fetchGroup() }, [fetchGroup])
  useEffect(() => { fetchMembers() }, [fetchMembers])
  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('members').select('id, first_name, last_name, member_number').eq('org_id', user.org_id).order('first_name')
      .then(({ data }) => { if (data) setMemberOptions(data as MemberOption[]) })
    supabase.from('ministries').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setMinistries(data as Ministry[]) })
  }, [user?.org_id])

  // New this month
  useEffect(() => {
    if (!groupId) return
    const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]
    supabase.from('group_memberships').select('*', { count: 'exact', head: true })
      .eq('group_id', groupId).gte('joined_at', monthStart)
      .then(({ count }) => { if (count !== null) setNewThisMonth(count) })
  }, [groupId])

  const handleRemoveMember = async (gmId: string) => {
    setRemovingId(gmId)
    const { error } = await supabase.from('group_memberships').update({ is_active: false, left_at: new Date().toISOString().split('T')[0] }).eq('id', gmId)
    if (error) { toast.error('Failed to remove member'); setRemovingId(null); return }
    toast.success('Member removed from group')
    setRemovingId(null)
    fetchMembers()
  }

  const memberRows = () => members.map(m => [
    m.member ? `${m.member.first_name} ${m.member.last_name}` : '',
    m.member?.member_number ?? '',
    m.role,
    m.joined_at ? format(new Date(m.joined_at), 'yyyy-MM-dd') : '',
    m.member?.membership_status ?? '',
  ])

  const exportCSV = () => {
    if (members.length === 0) { toast.info('No members to export'); return }
    const rows = [['Name', 'Member Number', 'Role', 'Joined At', 'Status'], ...memberRows()]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(group?.name ?? 'group').replace(/\s+/g, '-')}-members.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setExportOpen(false)
    toast.success('Members exported')
  }

  const exportExcel = () => {
    if (members.length === 0) { toast.info('No members to export'); return }
    const ws = XLSX.utils.aoa_to_sheet([['Name', 'Member Number', 'Role', 'Joined At', 'Status'], ...memberRows()])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Members')
    XLSX.writeFile(wb, `${(group?.name ?? 'group').replace(/\s+/g, '-')}-members.xlsx`)
    setExportOpen(false)
    toast.success('Members exported')
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        <div style={{ height: 24, width: 200, borderRadius: 4, background: '#F3F4F6', animation: 'pulse 1.4s infinite', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: 'var(--dm-bg-muted)', border: '0.5px solid var(--dm-border)' }} />)}
        </div>
      </>
    )
  }

  if (notFound || !group) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 18, color: '#111827' }}>Group not found</div>
        <button onClick={() => navigate(`/groups/${ministryId}`)} style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#4F6BED', background: 'none', border: 'none', cursor: 'pointer' }}>Back to Ministry</button>
      </div>
    )
  }

  const leaderCount = members.filter(m => m.role === 'leader').length
  const memberCount = members.filter(m => m.role === 'member').length

  const filteredMembers = members.filter(m => {
    if (roleFilter && m.role !== roleFilter) return false
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
    const name = m.member ? `${m.member.first_name} ${m.member.last_name}`.toLowerCase() : ''
    return name.includes(q) || (m.member?.member_number ?? '').toLowerCase().includes(q)
  })

  const existingMemberIds = members.map(m => m.member?.id ?? '').filter(Boolean)
  const tabs: { key: GroupTab; label: string }[] = [
    { key: 'members', label: `Members (${members.length})` },
  ]

  const inputStyle: React.CSSProperties = { height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none' }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .gd-row:hover { background: var(--dm-bg-muted) !important; }
        .gd-input:focus { border-color: #4F6BED !important; }
      `}</style>

      {showAddMember && user && (
        <AddMemberModal group={group} existingMemberIds={existingMemberIds} orgId={user.org_id} onAdd={() => { setShowAddMember(false); fetchMembers() }} onClose={() => setShowAddMember(false)} />
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = '#111827')} onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
          <BackIcon />
        </button>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>Ministries</button>
        <SlashIcon />
        <button onClick={() => navigate(`/groups/${ministryId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>{group.ministries?.name ?? 'Ministry'}</button>
        <SlashIcon />
        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', fontWeight: 500 }}>{group.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.015em', margin: 0 }}>{group.name}</h1>
            {group.ministries && (
              <button onClick={() => navigate(`/groups/${ministryId}`)} style={{ display: 'inline-flex', background: '#E8ECF9', color: '#4F6BED', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11, border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#D5DCFA')} onMouseLeave={e => (e.currentTarget.style.background = '#E8ECF9')}>{group.ministries.name}</button>
            )}
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: group.is_active ? '#DCFCE7' : '#F3F4F6', color: group.is_active ? '#166534' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11 }}>{group.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          {schedules.length === 1 && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)', marginTop: 2 }}>
              {[schedules[0].meeting_day, formatScheduleTime(schedules[0].meeting_time), schedules[0].meeting_venue].filter(Boolean).join(' · ')}
            </div>
          )}
          {schedules.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
              {schedules.map(s => (
                <div key={s.id} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
                  {[s.meeting_day.slice(0, 3), formatScheduleTime(s.meeting_time), s.meeting_venue].filter(Boolean).join(' · ')}
                </div>
              ))}
            </div>
          )}
          {group.leader && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              {(() => { const { bg, color } = avatarColor(group.leader.first_name + group.leader.last_name); return <div style={{ width: 20, height: 20, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{group.leader.first_name[0]}{group.leader.last_name[0]}</div> })()}
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)' }}>{group.leader.first_name} {group.leader.last_name}</span>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-body)' }}>· Leader</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(o => !o)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dm-border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dm-border)')}
            >
              <DownloadIcon /> Export
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {exportOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 50, minWidth: 190, overflow: 'hidden' }}>
                <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Export as CSV</button>
                <button onClick={exportExcel} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Export as Excel (.xlsx)</button>
              </div>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => setActiveTab('settings')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', color: 'var(--dm-text-body)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dm-border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dm-border)')}
            >
              <PencilIcon /> Edit Group
            </button>
          )}
          {(canManage || isGroupLeader) && (
            <button onClick={() => setShowAddMember(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <PlusIcon /> Add Member
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total Members" value={members.length} sub={`${leaderCount} leader · ${memberCount} member`} accent="#4F6BED" />
        <StatCard label="New This Month" value={newThisMonth} sub="joined this month" accent="#22C55E" />
        <StatCard label="Active Rate" value={members.length > 0 ? `${Math.round((members.filter(m => m.member?.membership_status === 'active').length / members.length) * 100)}%` : '—'} sub="members active" accent="#C8964A" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: activeTab === tab.key ? '#4F6BED' : '#6B7280', borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer', transition: 'color 0.12s' }} onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#374151' }} onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#6B7280' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Members Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: 12, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}><SearchIcon /></span>
              <input className="gd-input" type="text" placeholder="Search by name or number…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }} />
            </div>
            <select className="gd-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
              <option value="">All Roles</option>
              <option value="leader">Leader</option>
              <option value="member">Member</option>
            </select>
            <button onClick={() => { setMemberSearch(''); setRoleFilter('') }} style={{ ...inputStyle, padding: '0 12px', cursor: 'pointer', color: '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500 }}>Clear</button>
          </div>

          <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Member', 'Role', 'Joined', ''].map(h => (
                    <th key={h} style={{ padding: '11px 18px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
                    {members.length === 0 ? 'No members yet — click Add Member to get started' : 'No members match your filters'}
                  </td></tr>
                ) : filteredMembers.map(gm => (
                  <tr key={gm.id} className="gd-row" style={{ borderBottom: '0.5px solid var(--dm-border-soft)', height: 56, background: 'var(--dm-bg-card)', transition: 'background 0.1s' }}>
                    <td style={{ padding: '0 18px' }}>
                      {gm.member && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <MemberAvatar firstName={gm.member.first_name} lastName={gm.member.last_name} photoUrl={gm.member.photo_url} size={32} />
                          <div>
                            <button onClick={() => navigate(`/members/${gm.member!.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-ink)', textAlign: 'left' }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')}>
                              {gm.member.first_name} {gm.member.last_name}
                            </button>
                            {gm.member.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{gm.member.member_number}</div>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0 18px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 5, background: gm.role === 'leader' ? '#FFF8EC' : '#F3F4F6', color: gm.role === 'leader' ? '#C8964A' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11.5, textTransform: 'capitalize' }}>{gm.role}</span>
                    </td>
                    <td style={{ padding: '0 18px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{gm.joined_at ? format(new Date(gm.joined_at), 'MMM dd, yyyy') : '—'}</span>
                    </td>
                    <td style={{ padding: '0 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => gm.member && navigate(`/members/${gm.member.id}`)} style={{ width: 26, height: 26, borderRadius: 5, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', color: 'var(--dm-text-secondary)', cursor: 'pointer' }}>
                          <ArrowRightIcon />
                        </button>
                        {(canManage || isGroupLeader) && (
                          <button
                            onClick={() => handleRemoveMember(gm.id)}
                            disabled={removingId === gm.id}
                            title="Remove from group"
                            style={{ width: 26, height: 26, borderRadius: 5, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', cursor: removingId === gm.id ? 'not-allowed' : 'pointer', color: 'var(--dm-text-muted)', fontSize: 16, lineHeight: 1, fontFamily: 'monospace' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#9CA3AF' }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Settings Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <GroupSettingsTab group={group} ministries={ministries} members={memberOptions} canManage={canManage} initialSchedules={schedules} onSaved={() => { fetchGroup(); fetchSchedules() }} />
      )}
    </>
  )
}

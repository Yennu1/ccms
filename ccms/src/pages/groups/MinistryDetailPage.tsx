import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type DetailTab = 'groups' | 'members' | 'settings'

interface Ministry {
  id: string; org_id: string; name: string; description: string | null
  is_org_wide: boolean; is_active: boolean; branch_id: string | null; leader_id: string | null
  branches: { id: string; name: string } | null
  leader: { id: string; first_name: string; last_name: string; member_number: string | null } | null
}

interface GroupSchedule { id: string; group_id: string; meeting_day: string; meeting_time: string; meeting_venue: string | null }

interface Group {
  id: string; name: string; description: string | null; is_active: boolean
  meeting_schedule: string | null; leader_id: string | null
  leader: { id: string; first_name: string; last_name: string } | null
  _memberCount?: number
  _schedules?: GroupSchedule[]
}

interface MinistryMember {
  id: string; group_id: string; role: string; joined_at: string | null; is_active: boolean
  member: { id: string; first_name: string; last_name: string; member_number: string | null; membership_status: string } | null
  group: { id: string; name: string } | null
}

interface Branch { id: string; name: string }
interface MemberOption { id: string; first_name: string; last_name: string; member_number: string | null }

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
function ArrowRightIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function DownloadIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3v8M5 8l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronDownIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, size = 32 }: { firstName: string; lastName: string; size?: number }) {
  const { bg, color } = avatarColor(firstName + lastName)
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: size * 0.34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{firstName[0]?.toUpperCase()}{lastName[0]?.toUpperCase()}</div>
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E6E8F0', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, background: accent }} />
    </div>
  )
}

// ─── Settings Form ────────────────────────────────────────────────────────────

function SettingsTab({ ministry, branches, members, onSaved, canManage }: {
  ministry: Ministry; branches: Branch[]; members: MemberOption[]; onSaved: () => void; canManage: boolean
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(ministry.name)
  const [description, setDescription] = useState(ministry.description ?? '')
  const [isOrgWide, setIsOrgWide] = useState(ministry.is_org_wide)
  const [branchId, setBranchId] = useState(ministry.branch_id ?? '')
  const [leaderId, setLeaderId] = useState(ministry.leader_id ?? '')
  const [isActive, setIsActive] = useState(ministry.is_active)
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
    return !q || m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || (m.member_number ?? '').toLowerCase().includes(q)
  })

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('ministries').update({
      name: name.trim(), description: description.trim() || null,
      is_org_wide: isOrgWide, branch_id: isOrgWide ? null : (branchId || null),
      leader_id: leaderId || null, is_active: isActive,
    }).eq('id', ministry.id)
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success('Ministry updated')
    setSaving(false); onSaved()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { data: groupsData } = await supabase.from('groups').select('id').eq('ministry_id', ministry.id)
    if (groupsData && groupsData.length > 0) {
      const ids = groupsData.map((g: { id: string }) => g.id)
      await supabase.from('group_memberships').delete().in('group_id', ids)
      await supabase.from('groups').delete().eq('ministry_id', ministry.id)
    }
    await supabase.from('ministries').delete().eq('id', ministry.id)
    toast.success('Ministry deleted'); navigate('/groups')
  }

  const inputBase: React.CSSProperties = { width: '100%', height: 38, borderRadius: 8, border: '0.5px solid #E5E7EB', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#111827', background: '#fff', outline: 'none', padding: '0 12px', boxSizing: 'border-box' }
  const labelSt: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 20, paddingBottom: 12, borderBottom: '0.5px solid #F3F4F6' }}>Edit Ministry</div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Ministry Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!canManage} style={{ ...inputBase, borderColor: '#E5E7EB', opacity: canManage ? 1 : 0.6 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={!canManage} rows={3} style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5, opacity: canManage ? 1 : 0.6 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: true, l: 'Org-Wide' }, { v: false, l: 'Branch-Specific' }].map(opt => (
              <button key={String(opt.v)} type="button" disabled={!canManage} onClick={() => { setIsOrgWide(opt.v); if (opt.v) setBranchId('') }} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isOrgWide === opt.v ? '#4F6BED' : '#E5E7EB'}`, background: isOrgWide === opt.v ? '#EEF1FD' : '#fff', cursor: canManage ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isOrgWide === opt.v ? '#4F6BED' : '#374151', opacity: canManage ? 1 : 0.6 }}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        {!isOrgWide && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Branch</label>
            <div style={{ position: 'relative' }}>
              <select value={branchId} onChange={e => setBranchId(e.target.value)} disabled={!canManage} style={{ ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer', opacity: canManage ? 1 : 0.6, color: branchId ? '#111827' : '#9CA3AF' }}>
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><ChevronDownIcon /></span>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Leader</label>
          <div ref={leaderRef} style={{ position: 'relative' }}>
            <input type="text" value={leaderOpen ? leaderQuery : leaderText} onChange={e => { setLeaderQuery(e.target.value); setLeaderOpen(true) }} onFocus={() => { setLeaderQuery(''); setLeaderOpen(true) }} placeholder="Search members…" disabled={!canManage} style={{ ...inputBase, paddingRight: 32, cursor: 'pointer', opacity: canManage ? 1 : 0.6 }} readOnly={!leaderOpen} />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><ChevronDownIcon /></span>
            {leaderOpen && canManage && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
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
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(opt => (
              <button key={String(opt.v)} type="button" disabled={!canManage} onClick={() => setIsActive(opt.v)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isActive === opt.v ? '#4F6BED' : '#E5E7EB'}`, background: isActive === opt.v ? '#EEF1FD' : '#fff', cursor: canManage ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isActive === opt.v ? '#4F6BED' : '#374151', opacity: canManage ? 1 : 0.6 }}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: saving ? '#818CF8' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      {canManage && (
        <div style={{ background: '#fff', border: '0.5px solid #FCA5A5', borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#EF4444', marginBottom: 8 }}>Danger Zone</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Deleting this ministry will also remove all associated groups and memberships.</div>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid #FCA5A5', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>Delete Ministry</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151' }}>Are you sure?</span>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#fff' }}>{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MinistryDetailPage() {
  const { ministryId } = useParams<{ ministryId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ministry, setMinistry] = useState<Ministry | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [allMembers, setAllMembers] = useState<MinistryMember[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DetailTab>('groups')
  const [groupSearch, setGroupSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [notFound, setNotFound] = useState(false)

  const canManage = user?.role === 'super_admin' || user?.role === 'pastor'

  const fetchMinistry = useCallback(async () => {
    if (!ministryId) return
    const { data, error } = await supabase
      .from('ministries')
      .select('*, branches(id, name), leader:members!ministries_leader_id_fkey(id, first_name, last_name, member_number)')
      .eq('id', ministryId)
      .single()
    if (error || !data) { setNotFound(true); setLoading(false); return }
    setMinistry(data as unknown as Ministry)
    setLoading(false)
  }, [ministryId])

  const fetchGroups = useCallback(async () => {
    if (!ministryId) return
    const { data } = await supabase
      .from('groups')
      .select('id, name, description, is_active, meeting_schedule, leader_id, leader:members!groups_leader_id_fkey(id, first_name, last_name)')
      .eq('ministry_id', ministryId)
      .order('name')
    const groupList = (data ?? []) as unknown as Group[]
    const ids = groupList.map(g => g.id)
    if (ids.length > 0) {
      const [{ data: counts }, { data: schedData }] = await Promise.all([
        supabase.from('group_memberships').select('group_id').in('group_id', ids).eq('is_active', true),
        supabase.from('group_schedules').select('id, group_id, meeting_day, meeting_time, meeting_venue').in('group_id', ids).order('meeting_day'),
      ])
      const countMap: Record<string, number> = {}
      ;(counts ?? []).forEach((r: { group_id: string }) => { countMap[r.group_id] = (countMap[r.group_id] ?? 0) + 1 })
      const schedMap: Record<string, GroupSchedule[]> = {}
      ;(schedData ?? []).forEach((s: GroupSchedule) => { schedMap[s.group_id] = [...(schedMap[s.group_id] ?? []), s] })
      groupList.forEach(g => { g._memberCount = countMap[g.id] ?? 0; g._schedules = schedMap[g.id] ?? [] })
    }
    setGroups(groupList)
  }, [ministryId])

  const fetchAllMembers = useCallback(async () => {
    if (!ministryId) return
    const { data: grpData } = await supabase.from('groups').select('id').eq('ministry_id', ministryId)
    const groupIds = (grpData ?? []).map((g: { id: string }) => g.id)
    if (groupIds.length === 0) { setAllMembers([]); return }
    const { data } = await supabase
      .from('group_memberships')
      .select('id, group_id, role, joined_at, is_active, member:members!group_memberships_member_id_fkey(id, first_name, last_name, member_number, membership_status), group:groups!group_memberships_group_id_fkey(id, name)')
      .in('group_id', groupIds)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })
    setAllMembers((data ?? []) as unknown as MinistryMember[])
  }, [ministryId])

  useEffect(() => { fetchMinistry() }, [fetchMinistry])
  useEffect(() => { fetchGroups() }, [fetchGroups])
  useEffect(() => { fetchAllMembers() }, [fetchAllMembers])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name').then(({ data }) => { if (data) setBranches(data as Branch[]) })
    supabase.from('members').select('id, first_name, last_name, member_number').eq('org_id', user.org_id).order('first_name').then(({ data }) => { if (data) setMemberOptions(data as MemberOption[]) })
  }, [user?.org_id])

  const handleExportMembers = () => {
    if (allMembers.length === 0) { toast.info('No members to export'); return }
    const rows = [
      ['Name', 'Member Number', 'Group', 'Role', 'Joined At', 'Status'],
      ...allMembers.map(m => [
        m.member ? `${m.member.first_name} ${m.member.last_name}` : '',
        m.member?.member_number ?? '',
        m.group?.name ?? '',
        m.role,
        m.joined_at ? format(new Date(m.joined_at), 'yyyy-MM-dd') : '',
        m.member?.membership_status ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${ministry?.name ?? 'ministry'}-members.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Members exported')
  }

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        <div style={{ height: 24, width: 200, borderRadius: 4, background: '#F3F4F6', animation: 'pulse 1.4s infinite', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: '#F9FAFB', border: '0.5px solid #E5E7EB' }} />)}
        </div>
      </>
    )
  }

  if (notFound || !ministry) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 18, color: '#111827' }}>Ministry not found</div>
        <button onClick={() => navigate('/groups')} style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#4F6BED', background: 'none', border: 'none', cursor: 'pointer' }}>Back to Ministries</button>
      </div>
    )
  }

  const filteredGroups = groups.filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
  const filteredMembers = allMembers.filter(m => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
    const name = m.member ? `${m.member.first_name} ${m.member.last_name}`.toLowerCase() : ''
    return name.includes(q) || (m.member?.member_number ?? '').toLowerCase().includes(q)
  })

  const activeGroupCount = groups.filter(g => g.is_active).length
  const activeMemberCount = allMembers.length

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'groups', label: 'Groups' },
    { key: 'members', label: `Members (${activeMemberCount})` },
    { key: 'settings', label: 'Settings' },
  ]

  const inputStyle: React.CSSProperties = { height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#111827', background: '#fff', outline: 'none' }

  return (
    <>
      <style>{`
        .md-group-card:hover { border-color: #C7D0F8 !important; }
        .md-member-row:hover { background: #FAFBFE !important; }
        .md-input:focus { border-color: #4F6BED !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = '#111827')} onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
            <BackIcon />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: '#111827', letterSpacing: '-0.015em', margin: 0 }}>{ministry.name}</h1>
              {ministry.is_org_wide && <span style={{ display: 'inline-flex', background: '#E8ECF9', color: '#4F6BED', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>Org-Wide</span>}
              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: ministry.is_active ? '#DCFCE7' : '#F3F4F6', color: ministry.is_active ? '#166534' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11 }}>{ministry.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            {ministry.branches && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>{ministry.branches.name}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportMembers} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', color: '#374151', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}>
            <DownloadIcon /> Export Members
          </button>
          {canManage && (
            <button onClick={() => navigate(`/groups/${ministry.id}/new`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <PlusIcon /> New Group
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total Groups" value={groups.length} sub={`${activeGroupCount} active`} accent="#4F6BED" />
        <StatCard label="Total Members" value={activeMemberCount} sub="across all groups" accent="#22C55E" />
        <StatCard label="Active %" value={groups.length > 0 ? `${Math.round((activeGroupCount / groups.length) * 100)}%` : '—'} sub="groups active" accent="#C8964A" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: activeTab === tab.key ? '#4F6BED' : '#6B7280', borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer', transition: 'color 0.12s' }} onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#374151' }} onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#6B7280' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Groups Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, padding: 12, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, marginBottom: 18 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}><SearchIcon /></span>
              <input className="md-input" type="text" placeholder="Search groups…" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }} />
            </div>
            <button onClick={() => setGroupSearch('')} style={{ ...inputStyle, padding: '0 12px', cursor: 'pointer', color: '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500 }}>Clear</button>
          </div>
          {filteredGroups.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 15, color: '#111827' }}>{groups.length === 0 ? 'No groups yet' : 'No groups match your search'}</div>
              {canManage && groups.length === 0 && (
                <button onClick={() => navigate(`/groups/${ministry.id}/new`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <PlusIcon /> Create First Group
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {filteredGroups.map(group => {
                const scheds = group._schedules ?? []
                const first = scheds[0]
                const extra = scheds.length - 1
                return (
                  <div key={group.id} className="md-group-card" onClick={() => navigate(`/groups/${ministry.id}/${group.id}`)} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827' }}>{group.name}</div>
                        <span style={{ display: 'inline-flex', marginTop: 4, padding: '2px 8px', borderRadius: 999, background: group.is_active ? '#DCFCE7' : '#F3F4F6', color: group.is_active ? '#166534' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10.5 }}>{group.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #E5E7EB', display: 'grid', placeItems: 'center', color: '#9CA3AF', flexShrink: 0 }}><ArrowRightIcon /></div>
                    </div>
                    {group.leader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Avatar firstName={group.leader.first_name} lastName={group.leader.last_name} size={24} />
                        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151' }}>{group.leader.first_name} {group.leader.last_name}</span>
                      </div>
                    )}
                    {first && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                        <span>{[first.meeting_day.slice(0, 3), formatScheduleTime(first.meeting_time), first.meeting_venue].filter(Boolean).join(' · ')}</span>
                        {extra > 0 && <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: '#4F6BED', background: '#E8ECF9', borderRadius: 4, padding: '1px 5px' }}>+{extra} more</span>}
                      </div>
                    )}
                    <div style={{ paddingTop: 10, borderTop: '0.5px solid #F3F4F6', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280' }}>
                      {group._memberCount ?? 0} {(group._memberCount ?? 0) === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Members Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <>
          <div style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}><SearchIcon /></span>
              <input className="md-input" type="text" placeholder="Search members by name or number…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }} />
            </div>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Member', 'Group', 'Role', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '11px 18px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '0.5px solid #EFF1F7', background: '#FAFBFE', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                  <th style={{ padding: '11px 18px', borderBottom: '0.5px solid #EFF1F7', background: '#FAFBFE', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No members found</td></tr>
                ) : filteredMembers.map(m => (
                  <tr key={m.id} className="md-member-row" onClick={() => m.member && navigate(`/members/${m.member.id}`)} style={{ borderBottom: '0.5px solid #EFF1F7', height: 56, background: '#fff', transition: 'background 0.1s', cursor: 'pointer' }}>
                    <td style={{ padding: '0 18px' }}>
                      {m.member && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar firstName={m.member.first_name} lastName={m.member.last_name} size={32} />
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{m.member.first_name} {m.member.last_name}</div>
                            {m.member.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member.member_number}</div>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0 18px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', background: '#E8ECF9', color: '#4F6BED', borderRadius: 5, padding: '2px 8px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11.5 }}>{m.group?.name ?? '—'}</span>
                    </td>
                    <td style={{ padding: '0 18px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 5, background: m.role === 'leader' ? '#FFF8EC' : '#F3F4F6', color: m.role === 'leader' ? '#C8964A' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11.5, textTransform: 'capitalize' }}>{m.role}</span>
                    </td>
                    <td style={{ padding: '0 18px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6B7280' }}>{m.joined_at ? format(new Date(m.joined_at), 'MMM dd, yyyy') : '—'}</span>
                    </td>
                    <td style={{ padding: '0 12px' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, border: '0.5px solid #E5E7EB', display: 'grid', placeItems: 'center', color: '#6B7280' }}><ArrowRightIcon /></div>
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
        <SettingsTab ministry={ministry} branches={branches} members={memberOptions} onSaved={fetchMinistry} canManage={canManage} />
      )}
    </>
  )
}

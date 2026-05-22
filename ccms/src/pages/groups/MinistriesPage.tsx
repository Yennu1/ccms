import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type MinistryTab = 'all' | 'org_wide' | 'branch'

interface Branch { id: string; name: string }

interface Ministry {
  id: string
  org_id: string
  name: string
  description: string | null
  is_org_wide: boolean
  is_active: boolean
  branch_id: string | null
  leader_id: string | null
  created_at: string
  branches: { id: string; name: string } | null
  leader: { id: string; first_name: string; last_name: string; member_number: string | null } | null
  groups: { id: string }[]
  group_memberships: { id: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}
function ArrowRightIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function OrgWideIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12M2 8h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function Avatar({ firstName, lastName, size = 36 }: { firstName: string; lastName: string; size?: number }) {
  const { bg, color } = avatarColor(firstName + lastName)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: size * 0.33, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {firstName[0]?.toUpperCase()}{lastName[0]?.toUpperCase()}
    </div>
  )
}

function DeleteModal({ name, onConfirm, onCancel, deleting }: { name: string; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E7EB', padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: '#111827', marginBottom: 8 }}>Delete Ministry</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: '#111827' }}>{name}</strong>? This will also remove all associated groups and memberships. This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#374151' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: deleting ? '#FCA5A5' : '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrashIcon /> {deleting ? 'Deleting…' : 'Delete Ministry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MinistriesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MinistryTab>('all')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canManage = user?.role === 'super_admin' || user?.role === 'pastor'

  const fetchMinistries = useCallback(async () => {
    if (!user?.org_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('ministries')
      .select(`
        *,
        branches(id, name),
        leader:members!ministries_leader_id_fkey(id, first_name, last_name, member_number),
        groups(id),
        group_memberships:groups!groups_ministry_id_fkey(
          id,
          group_memberships(id)
        )
      `)
      .eq('org_id', user.org_id)
      .order('name')
    if (error) toast.error('Failed to load ministries')
    else setMinistries((data ?? []) as unknown as Ministry[])
    setLoading(false)
  }, [user?.org_id])

  useEffect(() => { fetchMinistries() }, [fetchMinistries])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    // Delete group_memberships for all groups in this ministry
    const { data: groupsData } = await supabase.from('groups').select('id').eq('ministry_id', deleteTarget.id)
    if (groupsData && groupsData.length > 0) {
      const groupIds = groupsData.map((g: { id: string }) => g.id)
      await supabase.from('group_memberships').delete().in('group_id', groupIds)
      await supabase.from('groups').delete().eq('ministry_id', deleteTarget.id)
    }
    const { error } = await supabase.from('ministries').delete().eq('id', deleteTarget.id)
    if (error) {
      toast.error('Failed to delete ministry')
    } else {
      toast.success('Ministry deleted')
      setDeleteTarget(null)
      fetchMinistries()
    }
    setDeleting(false)
  }

  const tabFiltered = ministries.filter(m => {
    if (activeTab === 'org_wide') return m.is_org_wide
    if (activeTab === 'branch') return !m.is_org_wide
    return true
  })

  const filtered = tabFiltered.filter(m => {
    const q = search.toLowerCase()
    const leaderName = m.leader ? `${m.leader.first_name} ${m.leader.last_name}`.toLowerCase() : ''
    const matchSearch = !q || m.name.toLowerCase().includes(q) || leaderName.includes(q)
    const matchBranch = !branchFilter || m.branch_id === branchFilter
    return matchSearch && matchBranch
  })

  // Stat computations
  const totalGroups = ministries.reduce((sum, m) => sum + (m.groups?.length ?? 0), 0)
  const countGroupMembers = (ministry: Ministry): number => {
    const rows = ministry.group_memberships as unknown as { group_memberships: { id: string }[] }[] | undefined
    return rows?.reduce((s, g) => s + (g.group_memberships?.length ?? 0), 0) ?? 0
  }
  const totalMembers = ministries.reduce((sum, m) => sum + countGroupMembers(m), 0)
  const mostActive = ministries.reduce<Ministry | null>((best, m) => {
    return countGroupMembers(m) > countGroupMembers(best ?? ({ group_memberships: [] } as unknown as Ministry)) ? m : best
  }, null)

  const tabs: { key: MinistryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'org_wide', label: 'Org-Wide' },
    { key: 'branch', label: 'Branch-Specific' },
  ]

  const inputStyle: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', background: '#fff', outline: 'none',
  }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .min-card:hover { border-color: #C7D0F8 !important; box-shadow: 0 2px 12px rgba(79,107,237,0.08) !important; }
        .min-filter-input:focus { border-color: #4F6BED !important; }
        .min-filter-select:focus { border-color: #4F6BED !important; outline: none; }
      `}</style>

      {deleteTarget && (
        <DeleteModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: '#111827', letterSpacing: '-0.015em', margin: '0 0 4px' }}>Ministries & Groups</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280' }}>
            {loading ? 'Loading…' : `${ministries.length} ministries · ${totalGroups} groups`}
          </div>
        </div>
        {canManage && (
          <button onClick={() => navigate('/groups/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <PlusIcon /> New Ministry
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total Ministries" value={loading ? '—' : ministries.length} sub="active ministries" accent="#4F6BED" />
        <StatCard label="Total Groups" value={loading ? '—' : totalGroups} sub="across all ministries" accent="#8B5CF6" />
        <StatCard label="Total Members" value={loading ? '—' : totalMembers} sub="across all groups" accent="#22C55E" />
        <StatCard label="Most Active" value={loading ? '—' : (mostActive?.name ?? '—')} sub="by member count" accent="#C8964A" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid #E5E7EB', marginBottom: 18 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: activeTab === tab.key ? '#4F6BED' : '#6B7280', borderBottom: activeTab === tab.key ? '2px solid #4F6BED' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer', transition: 'color 0.12s' }} onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#374151' }} onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#6B7280' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: 14, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 11, pointerEvents: 'none', display: 'inline-flex' }}><SearchIcon /></span>
          <input className="min-filter-input" type="text" placeholder="Search ministries or leader..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 34, paddingRight: 12 }} />
        </div>
        <select className="min-filter-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inputStyle, padding: '0 10px', cursor: 'pointer' }}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setBranchFilter('') }} style={{ ...inputStyle, padding: '0 12px', cursor: 'pointer', color: '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500 }}>Clear Filters</button>
      </div>

      {/* Ministry Cards Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
              <div style={{ height: 14, width: '60%', borderRadius: 4, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 12 }} />
              <div style={{ height: 12, width: '40%', borderRadius: 4, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#E5E7EB" strokeWidth="2" fill="none" /><circle cx="16" cy="20" r="4" stroke="#E5E7EB" strokeWidth="2" fill="none" /><circle cx="32" cy="20" r="4" stroke="#E5E7EB" strokeWidth="2" fill="none" /><path d="M10 36c0-6 6-10 14-10s14 4 14 10" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: '#111827' }}>{ministries.length === 0 ? 'No ministries yet' : 'No ministries match your filters'}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>Create your first ministry to get started</div>
          {canManage && ministries.length === 0 && (
            <button onClick={() => navigate('/groups/new')} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <PlusIcon /> New Ministry
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map(ministry => {
            const groupCount = ministry.groups?.length ?? 0
            const memberCount = (ministry.group_memberships as unknown as { group_memberships: { id: string }[] }[])?.reduce((s, g) => s + (g.group_memberships?.length ?? 0), 0) ?? 0
            const leader = ministry.leader
            return (
              <div
                key={ministry.id}
                className="min-card"
                onClick={() => navigate(`/groups/${ministry.id}`)}
                style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', position: 'relative' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 15, color: '#111827' }}>{ministry.name}</span>
                      {ministry.is_org_wide && (
                        <span title="Org-Wide" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#E8ECF9', color: '#4F6BED', borderRadius: 5, padding: '2px 7px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 10.5 }}>
                          <OrgWideIcon /> Org-Wide
                        </span>
                      )}
                    </div>
                    {ministry.branches && (
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>{ministry.branches.name}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {canManage && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(ministry) }}
                        title="Delete ministry"
                        style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', display: 'grid', placeItems: 'center', color: '#9CA3AF', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#9CA3AF' }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                    <div style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #E5E7EB', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
                      <ArrowRightIcon />
                    </div>
                  </div>
                </div>

                {/* Description */}
                {ministry.description && (
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: '#6B7280', marginBottom: 14, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ministry.description}
                  </div>
                )}

                {/* Leader */}
                {leader && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Avatar firstName={leader.first_name} lastName={leader.last_name} size={28} />
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12.5, color: '#374151' }}>{leader.first_name} {leader.last_name}</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF' }}>Ministry Leader</div>
                    </div>
                  </div>
                )}

                {/* Footer Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '0.5px solid #F3F4F6' }}>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: '#111827', lineHeight: 1 }}>{groupCount}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{groupCount === 1 ? 'Group' : 'Groups'}</div>
                  </div>
                  <div style={{ width: '0.5px', height: 28, background: '#E5E7EB' }} />
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: '#111827', lineHeight: 1 }}>{memberCount}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{memberCount === 1 ? 'Member' : 'Members'}</div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, background: ministry.is_active ? '#DCFCE7' : '#F3F4F6', color: ministry.is_active ? '#166534' : '#6B7280', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11 }}>
                    {ministry.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

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

const DRAFT_KEY = 'ccms_ministry_draft'

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function ChevronDownIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MinistryNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [branches, setBranches] = useState<Branch[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state — load from draft
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
  const draft = loadDraft()

  const [name, setName] = useState(draft?.name ?? '')
  const [description, setDescription] = useState(draft?.description ?? '')
  const [isOrgWide, setIsOrgWide] = useState(draft?.isOrgWide ?? true)
  const [branchId, setBranchId] = useState(draft?.branchId ?? '')
  const [leaderId, setLeaderId] = useState(draft?.leaderId ?? '')
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderDropdownOpen, setLeaderDropdownOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const leaderDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('members').select('id, first_name, last_name, member_number').eq('org_id', user.org_id).order('first_name')
      .then(({ data }) => { if (data) setMembers(data as MemberOption[]); setLoadingMembers(false) })
  }, [user?.org_id])

  // Auto-save draft (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, description, isOrgWide, branchId, leaderId }))
    }, 600)
    return () => clearTimeout(t)
  }, [name, description, isOrgWide, branchId, leaderId])

  // Close leader dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (leaderDropRef.current && !leaderDropRef.current.contains(e.target as Node)) setLeaderDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedLeader = members.find(m => m.id === leaderId)
  const leaderDisplayText = selectedLeader
    ? `${selectedLeader.first_name} ${selectedLeader.last_name}${selectedLeader.member_number ? ` · ${selectedLeader.member_number}` : ''}`
    : ''

  const filteredMembers = members.filter(m => {
    const q = leaderQuery.toLowerCase()
    return !q || m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || (m.member_number ?? '').toLowerCase().includes(q)
  })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Ministry name is required'
    if (!isOrgWide && !branchId) errs.branchId = 'Please select a branch'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    if (!user?.org_id) return
    setSaving(true)

    const payload: Record<string, unknown> = {
      org_id: user.org_id,
      name: name.trim(),
      description: description.trim() || null,
      is_org_wide: isOrgWide,
      branch_id: isOrgWide ? null : (branchId || null),
      leader_id: leaderId || null,
      is_active: true,
    }

    const { data, error } = await supabase.from('ministries').insert(payload).select().single()
    if (error) {
      toast.error('Failed to create ministry: ' + error.message)
      setSaving(false)
      return
    }
    localStorage.removeItem(DRAFT_KEY)
    toast.success('Ministry created successfully')
    navigate(`/groups/${data.id}`)
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8, border: '0.5px solid #E5E7EB',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#111827',
    background: '#fff', outline: 'none', padding: '0 12px', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12,
    color: '#374151', display: 'block', marginBottom: 6,
  }
  const errorStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#EF4444', marginTop: 4,
  }

  return (
    <>
      <style>{`.mn-input:focus { border-color: #4F6BED !important; }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = '#111827')} onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
          <BackIcon />
        </button>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: '#111827', letterSpacing: '-0.015em', margin: 0, lineHeight: 1.2 }}>Create Ministry</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            Draft auto-saved
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 20, paddingBottom: 12, borderBottom: '0.5px solid #F3F4F6' }}>Ministry Details</div>

            {/* Name */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Ministry Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input className="mn-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Youth Ministry" style={{ ...inputBase, borderColor: errors.name ? '#FCA5A5' : '#E5E7EB' }} />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Description <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="mn-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this ministry..." rows={3} style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {/* Type Toggle */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Ministry Type <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: true, label: 'Org-Wide', desc: 'No branch restriction' },
                  { value: false, label: 'Branch-Specific', desc: 'Linked to a branch' },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => { setIsOrgWide(opt.value); if (opt.value) setBranchId('') }}
                    style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${isOrgWide === opt.value ? '#4F6BED' : '#E5E7EB'}`, background: isOrgWide === opt.value ? '#EEF1FD' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isOrgWide === opt.value ? '#4F6BED' : '#374151' }}>{opt.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Branch (conditional) */}
            {!isOrgWide && (
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Branch <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <select className="mn-input" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer', borderColor: errors.branchId ? '#FCA5A5' : '#E5E7EB', color: branchId ? '#111827' : '#9CA3AF' }}>
                    <option value="" disabled>Select branch…</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><ChevronDownIcon /></span>
                </div>
                {errors.branchId && <div style={errorStyle}>{errors.branchId}</div>}
              </div>
            )}

            {/* Ministry Leader */}
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Ministry Leader <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              {loadingMembers ? (
                <div style={{ height: 38, background: '#F3F4F6', borderRadius: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
              ) : (
                <div ref={leaderDropRef} style={{ position: 'relative' }}>
                  <input type="text" className="mn-input"
                    value={leaderDropdownOpen ? leaderQuery : leaderDisplayText}
                    onChange={e => { setLeaderQuery(e.target.value); setLeaderDropdownOpen(true) }}
                    onFocus={() => { setLeaderQuery(''); setLeaderDropdownOpen(true) }}
                    placeholder="Search members…"
                    style={{ ...inputBase, paddingRight: 32, cursor: 'pointer' }}
                    readOnly={!leaderDropdownOpen}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><ChevronDownIcon /></span>
                  {leaderDropdownOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                      {leaderId && (
                        <button type="button" onClick={() => { setLeaderId(''); setLeaderDropdownOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          Clear leader
                        </button>
                      )}
                      {filteredMembers.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No members found</div>
                      ) : filteredMembers.map(m => {
                        const { bg, color } = avatarColor(m.first_name + m.last_name)
                        return (
                          <button type="button" key={m.id} onClick={() => { setLeaderId(m.id); setLeaderDropdownOpen(false); setLeaderQuery('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: m.id === leaderId ? '#F0F2FE' : 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = m.id === leaderId ? '#F0F2FE' : 'none')}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {m.first_name[0]}{m.last_name[0]}
                            </div>
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{m.first_name} {m.last_name}</div>
                              {m.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate('/groups')} style={{ height: 38, padding: '0 20px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#374151' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: saving ? '#818CF8' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
              {saving ? 'Creating…' : 'Create Ministry'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

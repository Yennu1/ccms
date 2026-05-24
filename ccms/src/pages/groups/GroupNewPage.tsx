import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ministry { id: string; name: string; org_id: string }
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DRAFT_KEY = (ministryId: string) => `ccms_group_draft_${ministryId}`

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronDownIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function SlashIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M5 14L11 2" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" /></svg> }

// ─── Main Component ───────────────────────────────────────────────────────────

export function GroupNewPage() {
  const { ministryId } = useParams<{ ministryId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ministry, setMinistry] = useState<Ministry | null>(null)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadDraft = () => {
    try { const r = localStorage.getItem(DRAFT_KEY(ministryId ?? '')); return r ? JSON.parse(r) : null } catch { return null }
  }
  const draft = loadDraft()

  const [name, setName] = useState(draft?.name ?? '')
  const [description, setDescription] = useState(draft?.description ?? '')
  const [leaderId, setLeaderId] = useState(draft?.leaderId ?? '')
  const [meetingDay, setMeetingDay] = useState(draft?.meetingDay ?? '')
  const [meetingTime, setMeetingTime] = useState(draft?.meetingTime ?? '')
  const [meetingVenue, setMeetingVenue] = useState(draft?.meetingVenue ?? '')
  const [isActive, setIsActive] = useState(draft?.isActive ?? true)
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderOpen, setLeaderOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const leaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ministryId) return
    supabase.from('ministries').select('id, name, org_id').eq('id', ministryId).single()
      .then(({ data }) => { if (data) setMinistry(data as Ministry) })
  }, [ministryId])

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('members').select('id, first_name, last_name, member_number').eq('org_id', user.org_id).order('first_name')
      .then(({ data }) => { if (data) setMembers(data as MemberOption[]); setLoadingMembers(false) })
  }, [user?.org_id])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!ministryId) return
      localStorage.setItem(DRAFT_KEY(ministryId), JSON.stringify({ name, description, leaderId, meetingDay, meetingTime, meetingVenue, isActive }))
    }, 600)
    return () => clearTimeout(t)
  }, [name, description, leaderId, meetingDay, meetingTime, meetingVenue, isActive, ministryId])

  useEffect(() => {
    function h(e: MouseEvent) { if (leaderRef.current && !leaderRef.current.contains(e.target as Node)) setLeaderOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedLeader = members.find(m => m.id === leaderId)
  const leaderText = selectedLeader ? `${selectedLeader.first_name} ${selectedLeader.last_name}${selectedLeader.member_number ? ` · ${selectedLeader.member_number}` : ''}` : ''
  const filteredMembers = members.filter(m => {
    const q = leaderQuery.toLowerCase()
    return !q || m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || (m.member_number ?? '').toLowerCase().includes(q)
  })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Group name is required'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (!user?.org_id || !ministryId || !ministry) return

    setSaving(true)

    const scheduleParts = [meetingDay, meetingTime, meetingVenue].filter(Boolean)
    const meetingSchedule = scheduleParts.length > 0 ? scheduleParts.join(' · ') : null

    const payload = {
      org_id: user.org_id,
      ministry_id: ministryId,
      branch_id: null,
      name: name.trim(),
      description: description.trim() || null,
      leader_id: leaderId || null,
      meeting_schedule: meetingSchedule,
      is_active: isActive,
    }

    const { data, error } = await supabase.from('groups').insert(payload).select().single()
    if (error) { toast.error('Failed to create group: ' + error.message); setSaving(false); return }

    localStorage.removeItem(DRAFT_KEY(ministryId))
    toast.success('Group created successfully')
    navigate(`/groups/${ministryId}/${data.id}`)
  }

  const inputBase: React.CSSProperties = { width: '100%', height: 38, borderRadius: 8, border: '0.5px solid #E5E7EB', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#111827', background: '#fff', outline: 'none', padding: '0 12px', boxSizing: 'border-box', transition: 'border-color 0.15s' }
  const labelStyle: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }
  const errorStyle: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#EF4444', marginTop: 4 }

  return (
    <>
      <style>{`.gn-input:focus { border-color: #4F6BED !important; }`}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = '#111827')} onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
          <BackIcon />
        </button>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>Ministries</button>
        <SlashIcon />
        <button onClick={() => navigate(`/groups/${ministryId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>{ministry?.name ?? '…'}</button>
        <SlashIcon />
        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151', fontWeight: 500 }}>Create Group</span>
      </div>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: '#111827', letterSpacing: '-0.015em', margin: '0 0 4px' }}>Create Group</h1>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Draft auto-saved</div>

      <div style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 20, paddingBottom: 12, borderBottom: '0.5px solid #F3F4F6' }}>Group Details</div>

            {/* Name */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Group Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input className="gn-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Young Adults Group" style={{ ...inputBase, borderColor: errors.name ? '#FCA5A5' : '#E5E7EB' }} />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Description <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="gn-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this group…" rows={3} style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {/* Group Leader */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Group Leader <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              {loadingMembers ? (
                <div style={{ height: 38, background: '#F3F4F6', borderRadius: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
              ) : (
                <div ref={leaderRef} style={{ position: 'relative' }}>
                  <input type="text" className="gn-input"
                    value={leaderOpen ? leaderQuery : leaderText}
                    onChange={e => { setLeaderQuery(e.target.value); setLeaderOpen(true) }}
                    onFocus={() => { setLeaderQuery(''); setLeaderOpen(true) }}
                    placeholder="Search members…"
                    style={{ ...inputBase, paddingRight: 32, cursor: 'pointer' }}
                    readOnly={!leaderOpen}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><ChevronDownIcon /></span>
                  {leaderOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                      {leaderId && <button type="button" onClick={() => { setLeaderId(''); setLeaderOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Clear leader</button>}
                      {filteredMembers.length === 0
                        ? <div style={{ padding: '10px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>No members found</div>
                        : filteredMembers.map(m => {
                          const { bg, color } = avatarColor(m.first_name + m.last_name)
                          return (
                            <button type="button" key={m.id} onClick={() => { setLeaderId(m.id); setLeaderOpen(false); setLeaderQuery('') }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: m.id === leaderId ? '#F0F2FE' : 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = m.id === leaderId ? '#F0F2FE' : 'none')}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.first_name[0]}{m.last_name[0]}</div>
                              <div>
                                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{m.first_name} {m.last_name}</div>
                                {m.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>}
                              </div>
                            </button>
                          )
                        })
                      }
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Meeting Day Pill Selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Meeting Day <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map(day => (
                  <button key={day} type="button" onClick={() => setMeetingDay(meetingDay === day ? '' : day)}
                    style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${meetingDay === day ? '#4F6BED' : '#E5E7EB'}`, background: meetingDay === day ? '#EEF1FD' : '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: meetingDay === day ? 600 : 500, fontSize: 13, color: meetingDay === day ? '#4F6BED' : '#374151', transition: 'all 0.12s' }}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Meeting Time */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Meeting Time <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              <input className="gn-input" type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} style={{ ...inputBase, width: 'auto', minWidth: 160 }} />
            </div>

            {/* Meeting Venue */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Meeting Venue <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
              <input className="gn-input" type="text" value={meetingVenue} onChange={e => setMeetingVenue(e.target.value)} placeholder="e.g. Fellowship Hall" style={{ ...inputBase }} />
            </div>

            {/* Status */}
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(opt => (
                  <button key={String(opt.v)} type="button" onClick={() => setIsActive(opt.v)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isActive === opt.v ? '#4F6BED' : '#E5E7EB'}`, background: isActive === opt.v ? '#EEF1FD' : '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isActive === opt.v ? '#4F6BED' : '#374151' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate(`/groups/${ministryId}`)} style={{ height: 38, padding: '0 20px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#374151' }} onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>Cancel</button>
            <button type="submit" disabled={saving} style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: saving ? '#818CF8' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

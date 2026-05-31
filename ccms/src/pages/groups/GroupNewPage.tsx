import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ministry { id: string; name: string; org_id: string }
interface MemberOption { id: string; first_name: string; last_name: string; member_number: string | null }
interface ScheduleEntry { localId: string; day: string; time: string; venue: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { bg: 'var(--avatar-1-bg)', color: 'var(--avatar-1-fg)' },
  { bg: 'var(--avatar-2-bg)', color: 'var(--avatar-2-fg)' },
  { bg: 'var(--avatar-3-bg)', color: 'var(--avatar-3-fg)' },
  { bg: 'var(--avatar-4-bg)', color: 'var(--avatar-4-fg)' },
  { bg: 'var(--avatar-5-bg)', color: 'var(--avatar-5-fg)' },
  { bg: 'var(--avatar-6-bg)', color: 'var(--avatar-6-fg)' },
  { bg: 'var(--avatar-7-bg)', color: 'var(--avatar-7-fg)' },
  { bg: 'var(--avatar-8-bg)', color: 'var(--avatar-8-fg)' },
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

// ─── Schedule Builder ─────────────────────────────────────────────────────────

function ScheduleBuilder({ entries, onChange }: {
  entries: ScheduleEntry[]
  onChange: (entries: ScheduleEntry[]) => void
}) {
  const inputSt: React.CSSProperties = {
    width: '100%', height: 36, borderRadius: 8, border: '0.5px solid var(--dm-border-soft)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)',
    background: 'var(--dm-bg-card)', outline: 'none', padding: '0 10px', boxSizing: 'border-box',
  }

  const update = (id: string, field: keyof Omit<ScheduleEntry, 'localId'>, value: string) =>
    onChange(entries.map(e => e.localId === id ? { ...e, [field]: value } : e))

  const remove = (id: string) => {
    if (entries.length <= 1) return
    onChange(entries.filter(e => e.localId !== id))
  }

  const add = () => onChange([
    ...entries,
    { localId: `${Date.now()}`, day: '', time: '', venue: '' },
  ])

  return (
    <div>
      {entries.map((entry, i) => (
        <div key={entry.localId} style={{
          background: 'var(--dm-bg-surface)', border: '0.5px solid var(--dm-border-soft)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 10,
        }}>
          {/* Row header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {entries.length > 1 ? `Schedule ${i + 1}` : 'Schedule'}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => remove(entry.localId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dm-text-muted)', fontSize: 17, lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                aria-label="Remove schedule"
              >
                ×
              </button>
            )}
          </div>

          {/* Day pills */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-secondary)', marginBottom: 6 }}>Meeting Day</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DAYS.map(day => {
                const active = entry.day === day
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => update(entry.localId, 'day', active ? '' : day)}
                    style={{
                      height: 28, padding: '0 10px', borderRadius: 999,
                      border: `1.5px solid ${active ? '#4F6BED' : 'var(--dm-border-soft)'}`,
                      background: active ? 'var(--avatar-1-bg)' : 'var(--dm-bg-card)',
                      cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: active ? 600 : 500, fontSize: 12,
                      color: active ? '#4F6BED' : 'var(--dm-text-body)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time + Venue */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-secondary)', marginBottom: 4 }}>Time</div>
              <input
                className="gn-input"
                type="time"
                value={entry.time}
                onChange={e => update(entry.localId, 'time', e.target.value)}
                style={inputSt}
              />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-secondary)', marginBottom: 4 }}>Venue <span style={{ color: 'var(--dm-text-muted)' }}>(optional)</span></div>
              <input
                className="gn-input"
                type="text"
                value={entry.venue}
                onChange={e => update(entry.localId, 'venue', e.target.value)}
                placeholder="e.g. Fellowship Hall"
                style={inputSt}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 32, padding: '0 12px', borderRadius: 8,
          border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontWeight: 500, fontSize: 12.5, color: '#4F6BED',
          cursor: 'pointer', transition: 'all 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--avatar-1-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
      >
        + Add Another Meeting Time
      </button>
    </div>
  )
}

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
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(
    draft?.scheduleEntries ?? [{ localId: 'init', day: '', time: '', venue: '' }]
  )
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
      localStorage.setItem(DRAFT_KEY(ministryId), JSON.stringify({ name, description, leaderId, scheduleEntries, isActive }))
    }, 600)
    return () => clearTimeout(t)
  }, [name, description, leaderId, scheduleEntries, isActive, ministryId])

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

    const { data, error } = await supabase.from('groups').insert({
      org_id: user.org_id,
      ministry_id: ministryId,
      branch_id: null,
      name: name.trim(),
      description: description.trim() || null,
      leader_id: leaderId || null,
      meeting_schedule: null,
      is_active: isActive,
    }).select().single()

    if (error) { toast.error('Failed to create group: ' + error.message); setSaving(false); return }

    const validSchedules = scheduleEntries.filter(s => s.day && s.time)
    if (validSchedules.length > 0) {
      const { error: schErr } = await supabase.from('group_schedules').insert(
        validSchedules.map(s => ({
          group_id: data.id,
          meeting_day: s.day,
          meeting_time: s.time,
          meeting_venue: s.venue || null,
        }))
      )
      if (schErr) console.warn('Failed to save schedules:', schErr.message)
    }

    localStorage.removeItem(DRAFT_KEY(ministryId))
    toast.success('Group created successfully')
    navigate(`/groups/${ministryId}/${data.id}`)
  }

  const inputBase: React.CSSProperties = { width: '100%', height: 38, borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)', outline: 'none', padding: '0 12px', boxSizing: 'border-box', transition: 'border-color 0.15s' }
  const labelStyle: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-body)', display: 'block', marginBottom: 6 }
  const errorStyle: React.CSSProperties = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#EF4444', marginTop: 4 }

  return (
    <>
      <style>{`.gn-input:focus { border-color: #4F6BED !important; }`}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dm-text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--dm-text-ink)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--dm-text-secondary)')}>
          <BackIcon />
        </button>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>Ministries</button>
        <SlashIcon />
        <button onClick={() => navigate(`/groups/${ministryId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#4F6BED')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>{ministry?.name ?? '…'}</button>
        <SlashIcon />
        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-body)', fontWeight: 500 }}>Create Group</span>
      </div>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.015em', margin: '0 0 4px' }}>Create Group</h1>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 24 }}>Draft auto-saved</div>

      <div style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          {/* Group Details */}
          <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 20, paddingBottom: 12, borderBottom: '0.5px solid var(--dm-border-subtle)' }}>Group Details</div>

            {/* Name */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Group Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input className="gn-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Young Adults Group" style={{ ...inputBase, borderColor: errors.name ? '#FCA5A5' : '#E5E7EB' }} />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Description <span style={{ color: 'var(--dm-text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="gn-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this group…" rows={3} style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {/* Group Leader */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Group Leader <span style={{ color: 'var(--dm-text-muted)', fontWeight: 400 }}>(optional)</span></label>
              {loadingMembers ? (
                <div style={{ height: 38, background: 'var(--dm-bg-muted)', borderRadius: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
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
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                      {leaderId && <button type="button" onClick={() => { setLeaderId(''); setLeaderOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#EF4444' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Clear leader</button>}
                      {filteredMembers.length === 0
                        ? <div style={{ padding: '10px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>No members found</div>
                        : filteredMembers.map(m => {
                          const { bg, color } = avatarColor(m.first_name + m.last_name)
                          return (
                            <button type="button" key={m.id} onClick={() => { setLeaderId(m.id); setLeaderOpen(false); setLeaderQuery('') }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: m.id === leaderId ? 'var(--avatar-1-bg)' : 'none', border: 'none', cursor: 'pointer', padding: '8px 12px' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = m.id === leaderId ? 'var(--avatar-1-bg)' : 'none')}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.first_name[0]}{m.last_name[0]}</div>
                              <div>
                                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-ink)' }}>{m.first_name} {m.last_name}</div>
                                {m.member_number && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>{m.member_number}</div>}
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

            {/* Status */}
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(opt => (
                  <button key={String(opt.v)} type="button" onClick={() => setIsActive(opt.v)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isActive === opt.v ? '#4F6BED' : 'var(--dm-border-soft)'}`, background: isActive === opt.v ? 'var(--avatar-1-bg)' : 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: isActive === opt.v ? '#4F6BED' : 'var(--dm-text-body)' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Meeting Schedule */}
          <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)', marginBottom: 4, paddingBottom: 12, borderBottom: '0.5px solid var(--dm-border-subtle)' }}>Meeting Schedule</div>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', marginBottom: 16 }}>Add one or more recurring meeting times for this group.</div>
            <ScheduleBuilder entries={scheduleEntries} onChange={setScheduleEntries} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate(`/groups/${ministryId}`)} style={{ height: 38, padding: '0 20px', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>Cancel</button>
            <button type="submit" disabled={saving} style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: saving ? '#818CF8' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ───────────────────────────────────────────────────────────────────

const givingSchema = z.object({
  member_id:        z.string().optional(),
  is_anonymous:     z.boolean(),
  is_collective:    z.boolean(),
  offering_type:    z.string().optional(),
  category_id:      z.string().optional(),
  amount:           z.number().min(0.01, 'Amount must be greater than 0'),
  payment_method:   z.enum(['cash', 'momo', 'bank_transfer', 'cheque']),
  momo_network:     z.string().optional(),
  event_id:         z.string().optional(),
  transaction_date: z.string().min(1, 'Please select a date'),
  reference_number: z.string().optional(),
  notes:            z.string().optional(),
  branch_id:        z.string().min(1, 'Please select a branch'),
}).superRefine((data, ctx) => {
  if (!data.is_collective && (!data.category_id || data.category_id.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a category', path: ['category_id'] })
  }
})

type FormValues = z.infer<typeof givingSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbMember   { id: string; first_name: string; last_name: string; member_number: string }
interface DbCategory { id: string; name: string }
interface DbBranch   { id: string; name: string }
interface DbEvent    { id: string; name: string; starts_at: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTIVE_OFFERING_TYPES = [
  'Sunday Offering', 'Midweek Offering', 'Special Offering',
  'Harvest', 'Thanksgiving', 'Building Fund', 'Other',
]

const CAT_STYLE: Record<string, { dot: string; bg: string; color: string }> = {
  tithe:        { dot: '#C8964A', bg: '#FEF6E5', color: '#8A6418' },
  offering:     { dot: '#22C55E', bg: '#DCFCE7', color: '#166534' },
  building:     { dot: '#7B93F5', bg: '#E8ECF9', color: '#3349C7' },
  welfare:      { dot: '#8B5CF6', bg: '#EDE9FE', color: '#5B21B6' },
  thanksgiving: { dot: '#EF4444', bg: '#FFE4E6', color: '#9F1239' },
  special:      { dot: '#EC4899', bg: '#FCE7F3', color: '#9D174D' },
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
}

const MOMO_NETWORKS = [
  { key: 'mtn',        label: 'MTN',        color: '#F59E0B' },
  { key: 'vodafone',   label: 'Vodafone',   color: '#EF4444' },
  { key: 'airteltigo', label: 'AirtelTigo', color: '#3B82F6' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCatKey(name: string) {
  const l = (name ?? '').toLowerCase()
  if (l === 'tithe') return 'tithe'
  if (l === 'offering') return 'offering'
  if (l.includes('building')) return 'building'
  if (l === 'welfare') return 'welfare'
  if (l === 'thanksgiving') return 'thanksgiving'
  if (l.includes('special')) return 'special'
  return 'offering'
}

function getCatStyle(name: string) {
  return CAT_STYLE[getCatKey(name)] ?? CAT_STYLE.offering
}

function formatEventDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

function resolveCollectiveCategoryId(offeringType: string, categories: DbCategory[]): string {
  const lower = offeringType.toLowerCase()
  let match: DbCategory | undefined
  if (lower.includes('building')) {
    match = categories.find(c => c.name.toLowerCase().includes('building'))
  } else if (lower === 'thanksgiving' || lower === 'harvest') {
    match = categories.find(c => c.name.toLowerCase().includes('thanksgiving'))
    if (!match) match = categories.find(c => c.name.toLowerCase().includes('special'))
  } else if (lower.includes('special')) {
    match = categories.find(c => c.name.toLowerCase().includes('special'))
    if (!match) match = categories.find(c => c.name.toLowerCase().includes('offering'))
  } else {
    match = categories.find(c => {
      const n = c.name.toLowerCase()
      return n.includes('offering') && !n.includes('special')
    })
    if (!match) match = categories.find(c => c.name.toLowerCase().includes('offering'))
  }
  return match?.id ?? categories[0]?.id ?? ''
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RecordGivingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [members,     setMembers]     = useState<DbMember[]>([])
  const [categories,  setCategories]  = useState<DbCategory[]>([])
  const [branches,    setBranches]    = useState<DbBranch[]>([])
  const [events,      setEvents]      = useState<DbEvent[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting,  setSubmitting]  = useState(false)

  const [memberSearch,       setMemberSearch]       = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [momoNetwork,        setMomoNetwork]        = useState('mtn')
  const [momoNumber,         setMomoNumber]         = useState('')

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(givingSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method:   'cash' as const,
      is_anonymous:     false,
      is_collective:    false,
      offering_type:    'Sunday Offering',
    },
  })

  const isAnonymous        = watch('is_anonymous')
  const isCollective       = watch('is_collective')
  const selectedCategoryId = watch('category_id')
  const selectedMethod     = watch('payment_method')
  const selectedMemberId   = watch('member_id')
  const amountValue        = watch('amount')
  const transactionDate    = watch('transaction_date')
  const selectedEventId    = watch('event_id')
  const offeringType       = watch('offering_type')

  const selectedMember   = members.find(m => m.id === selectedMemberId)
  const selectedCategory = categories.find(c => c.id === selectedCategoryId)
  const selectedEvent    = events.find(e => e.id === selectedEventId)
  const filteredMembers  = members.filter(m => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.member_number.toLowerCase().includes(q)
  })

  useEffect(() => {
    if (!user?.org_id) return
    const load = async () => {
      setDataLoading(true)
      const [memRes, catRes, branchRes, eventRes] = await Promise.all([
        supabase.from('members')
          .select('id, first_name, last_name, member_number')
          .eq('org_id', user.org_id)
          .eq('membership_status', 'active')
          .order('first_name'),
        supabase.from('transaction_categories')
          .select('id, name')
          .eq('org_id', user.org_id)
          .order('name'),
        supabase.from('branches')
          .select('id, name')
          .eq('org_id', user.org_id),
        supabase.from('events')
          .select('id, name, starts_at')
          .eq('org_id', user.org_id)
          .order('starts_at', { ascending: false })
          .limit(20),
      ])
      if (!memRes.error)    setMembers((memRes.data ?? []) as DbMember[])
      if (!catRes.error) {
        const cats = (catRes.data ?? []) as DbCategory[]
        setCategories(cats)
        if (cats.length > 0) setValue('category_id', cats[0].id)
      }
      if (!branchRes.error) {
        const brs = (branchRes.data ?? []) as DbBranch[]
        setBranches(brs)
        if (brs.length > 0) setValue('branch_id', brs[0].id)
      }
      if (!eventRes.error)  setEvents((eventRes.data ?? []) as DbEvent[])
      setDataLoading(false)
    }
    load()
  }, [user?.org_id, setValue])

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setSubmitting(true)

    const category_id = data.is_collective
      ? resolveCollectiveCategoryId(data.offering_type ?? 'Sunday Offering', categories)
      : (data.category_id || null)

    const { error } = await supabase.from('transactions').insert({
      org_id:           user.org_id,
      branch_id:        data.branch_id,
      member_id:        data.is_collective ? null : (data.is_anonymous ? null : (data.member_id || null)),
      category_id,
      amount:           data.amount,
      currency:         'GHS',
      payment_method:   data.is_collective ? 'cash' : data.payment_method,
      event_id:         data.event_id || null,
      transaction_date: data.transaction_date,
      reference_number: data.reference_number || null,
      notes:            data.notes || null,
      recorded_by:      user.id,
      is_collective:    data.is_collective,
    })
    setSubmitting(false)
    if (!error) {
      toast.success(data.is_collective ? 'Collective offering recorded' : 'Giving recorded successfully')
      navigate('/donations')
    } else {
      toast.error(error.message)
    }
  }

  // ─── Style shorthands ──────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
    borderRadius: 12, padding: 20, marginBottom: 16,
  }
  const sectionLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: 'var(--dm-text-muted)', marginBottom: 14,
  }
  const fieldLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12, fontWeight: 500, color: 'var(--dm-text-body)',
    display: 'block', marginBottom: 6,
  }
  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', padding: '0 12px',
    boxSizing: 'border-box', outline: 'none',
    transition: 'border-color 0.15s',
  }
  const errorStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 11.5, color: '#EF4444', marginTop: 4,
  }

  const activeCatStyle = selectedCategory ? getCatStyle(selectedCategory.name) : null

  return (
    <>
      <style>{`
        .rg-input:focus { border-color: #4F6BED !important; }
        .rg-select:focus { border-color: #4F6BED !important; outline: none; }
        .cat-pill:hover { opacity: 0.8; }
        .method-pill:hover { opacity: 0.85; }
        .network-pill:hover { opacity: 0.85; }
        .member-result:hover { background: var(--dm-bg-muted) !important; }
        .rg-action-btn:hover { background: var(--dm-bg-muted) !important; }
        .mode-tab:hover { color: #374151 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/donations')}
          style={{ width: 32, height: 32, borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--dm-text-secondary)', flexShrink: 0 }}
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 20, color: '#111827', letterSpacing: '-0.015em', margin: 0 }}>
            Record Giving
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
            {isCollective ? 'Record a collective offering for a service or event' : 'Log a cash, MoMo, or bank contribution'}
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: '#6B7280', fontWeight: 500, flexShrink: 0 }}>
          Recording for:
        </span>
        <div style={{ display: 'flex', background: '#F4F5F7', borderRadius: 8, padding: 3, gap: 2 }}>
          {[
            { label: 'Individual Member', value: false },
            { label: 'Collective Offering', value: true },
          ].map(({ label, value }) => {
            const active = isCollective === value
            return (
              <button
                key={label}
                type="button"
                className="mode-tab"
                onClick={() => setValue('is_collective', value)}
                style={{
                  height: 30, padding: '0 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--dm-bg-card)' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 12.5,
                  color: active ? '#111827' : '#9CA3AF',
                  transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {isCollective && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: '#FEF6E5', color: '#8A6418', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C8964A', flexShrink: 0 }} />
            No member record linked
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div>

            {/* Section 1: Contributor — individual only */}
            {!isCollective && (
              <div style={card}>
                <div style={sectionLabel}>Contributor</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#374151' }}>Anonymous giving</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAnonymous
                      setValue('is_anonymous', next)
                      if (next) { setValue('member_id', undefined); setMemberSearch('') }
                    }}
                    style={{ width: 40, height: 22, borderRadius: 999, flexShrink: 0, background: isAnonymous ? '#4F6BED' : '#E5E7EB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.15s' }}
                    aria-label="Toggle anonymous"
                  >
                    <span style={{ position: 'absolute', top: 3, left: isAnonymous ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }} />
                  </button>
                </div>

                {isAnonymous ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F4F5F7', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5.5" r="2.5" stroke="#9CA3AF" strokeWidth="1.4" />
                        <path d="M2.5 13c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#374151' }}>Anonymous Giver</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>No member record linked</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={fieldLabel}>Member</label>
                    {selectedMember ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 10px', border: '1.5px solid #4F6BED', borderRadius: 8, background: '#EEF1FE' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                        </div>
                        <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#1B2352', flex: 1 }}>
                          {selectedMember.first_name} {selectedMember.last_name}
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280' }}>
                          {selectedMember.member_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => setValue('member_id', undefined)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'grid', placeItems: 'center' }}
                          aria-label="Remove member"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          className="rg-input"
                          type="text"
                          placeholder={dataLoading ? 'Loading members…' : 'Search member by name or ID...'}
                          value={memberSearch}
                          disabled={dataLoading}
                          onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true) }}
                          onFocus={() => setMemberDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                          style={inputBase}
                        />
                        {memberDropdownOpen && filteredMembers.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
                            {filteredMembers.map(m => (
                              <div
                                key={m.id}
                                className="member-result"
                                onMouseDown={() => { setValue('member_id', m.id); setMemberSearch(''); setMemberDropdownOpen(false) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: 'var(--dm-bg-card)' }}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8ECF9', color: '#4F6BED', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {m.first_name[0]}{m.last_name[0]}
                                </div>
                                <div>
                                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>{m.first_name} {m.last_name}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>{m.member_number}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Giving / Offering Details */}
            <div style={card}>
              <div style={sectionLabel}>{isCollective ? 'Offering Details' : 'Giving Details'}</div>

              {isCollective ? (
                <div style={{ marginBottom: 20 }}>
                  <label style={fieldLabel}>Offering Type</label>
                  <select
                    className="rg-select"
                    {...register('offering_type')}
                    style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}
                  >
                    {COLLECTIVE_OFFERING_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <label style={fieldLabel}>Category</label>
                  {dataLoading ? (
                    <div style={{ height: 36, background: '#F3F4F6', borderRadius: 8, marginBottom: 20 }} />
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: errors.category_id ? 4 : 20 }}>
                      {categories.map(c => {
                        const s = getCatStyle(c.name)
                        const active = selectedCategoryId === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="cat-pill"
                            onClick={() => setValue('category_id', c.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                              border: active ? `1.5px solid ${s.dot}` : '1.5px solid transparent',
                              background: active ? s.bg : '#F4F5F7',
                              color: active ? s.color : '#6B7280',
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontWeight: 600, fontSize: 12.5, transition: 'all 0.12s',
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: active ? s.dot : '#D1D5DB' }} />
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {errors.category_id && <div style={{ ...errorStyle, marginBottom: 16 }}>{errors.category_id.message}</div>}
                </>
              )}

              <label style={fieldLabel}>Amount</label>
              <div style={{ position: 'relative', marginBottom: errors.amount ? 4 : isCollective ? 0 : 20 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 500, color: '#9CA3AF', pointerEvents: 'none' }}>₵</span>
                <input
                  className="rg-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                  style={{ ...inputBase, height: 50, paddingLeft: 30, fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}
                />
              </div>
              {errors.amount && <div style={{ ...errorStyle, marginBottom: isCollective ? 0 : 16 }}>{errors.amount.message}</div>}

              {!isCollective && (
                <>
                  <label style={{ ...fieldLabel, marginTop: 20 }}>Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(['cash', 'momo', 'bank_transfer', 'cheque'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        className="method-pill"
                        onClick={() => setValue('payment_method', m)}
                        style={{
                          height: 38, borderRadius: 8, cursor: 'pointer',
                          border: selectedMethod === m ? '1.5px solid #4F6BED' : '1.5px solid #E5E7EB',
                          background: selectedMethod === m ? '#EEF1FE' : 'var(--dm-bg-card)',
                          color: selectedMethod === m ? '#4F6BED' : '#6B7280',
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 600, fontSize: 12.5, transition: 'all 0.12s',
                        }}
                      >
                        {METHOD_LABELS[m]}
                      </button>
                    ))}
                  </div>

                  {selectedMethod === 'momo' && (
                    <div style={{ background: '#FAFBFE', border: '0.5px solid #E8ECF9', borderRadius: 10, padding: 14, marginTop: 14 }}>
                      <label style={{ ...fieldLabel, marginBottom: 10 }}>Network</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        {MOMO_NETWORKS.map(n => (
                          <button
                            key={n.key}
                            type="button"
                            className="network-pill"
                            onClick={() => setMomoNetwork(n.key)}
                            style={{
                              flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                              border: momoNetwork === n.key ? `1.5px solid ${n.color}` : '1.5px solid #E5E7EB',
                              background: momoNetwork === n.key ? `${n.color}18` : 'var(--dm-bg-card)',
                              color: momoNetwork === n.key ? n.color : '#6B7280',
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontWeight: 600, fontSize: 12.5, transition: 'all 0.12s',
                            }}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                      <label style={fieldLabel}>MoMo Number (optional)</label>
                      <input
                        className="rg-input"
                        type="tel"
                        placeholder="024 XXX XXXX"
                        value={momoNumber}
                        onChange={e => setMomoNumber(e.target.value)}
                        style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Section 3: Branch, Event & Date */}
            <div style={card}>
              <div style={sectionLabel}>Event &amp; Date</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Branch</label>
                  <select className="rg-select" {...register('branch_id')} style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}>
                    <option value="">Select a branch…</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branch_id && <div style={errorStyle}>{errors.branch_id.message}</div>}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Linked Event {isCollective && <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>}</label>
                  <select className="rg-select" {...register('event_id')} style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}>
                    <option value="">No specific event</option>
                    {events.map(e => <option key={e.id} value={e.id}>{e.name} — {formatEventDate(e.starts_at)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Date</label>
                  <input className="rg-input" type="date" {...register('transaction_date')} style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }} />
                  {errors.transaction_date && <div style={errorStyle}>{errors.transaction_date.message}</div>}
                </div>
                <div>
                  <label style={fieldLabel}>Reference Number (optional)</label>
                  <input className="rg-input" type="text" placeholder="Auto-generated if left blank" {...register('reference_number')} style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }} />
                </div>
              </div>
            </div>

            {/* Section 4: Notes */}
            <div style={card}>
              <div style={sectionLabel}>Notes</div>
              <textarea
                className="rg-input"
                placeholder={isCollective ? 'Any notes about this collective offering…' : 'Any additional notes about this contribution...'}
                {...register('notes')}
                rows={3}
                style={{ ...inputBase, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
              />
              {isCollective && user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 10px', background: '#F4F5F7', borderRadius: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 11, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {(user.email ?? 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF' }}>Recorded By</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, fontWeight: 600, color: '#374151' }}>{user.email}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Preview card ── */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: '#FAFBFE', border: '0.5px solid #E8ECF9', borderRadius: 12, padding: 20 }}>
              <div style={sectionLabel}>Preview</div>

              <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px dashed #E5E7EB' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 10 }}>
                    {isCollective ? 'Collective Offering Receipt' : 'Contribution Receipt'}
                  </div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 30, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                    {amountValue && amountValue > 0 ? `₵${amountValue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '₵0.00'}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {isCollective ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#FEF6E5', color: '#8A6418', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C8964A' }} />
                        {offeringType ?? 'Sunday Offering'}
                      </span>
                    ) : activeCatStyle ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: activeCatStyle.bg, color: activeCatStyle.color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11.5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: activeCatStyle.dot }} />
                        {selectedCategory?.name ?? '—'}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>
                      {isCollective ? 'Type' : 'Member'}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                      {isCollective ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8964A' }} />
                          Collective
                        </span>
                      ) : isAnonymous ? 'Anonymous'
                        : selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}`
                        : '—'}
                    </span>
                  </div>
                  {!isCollective && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Method</span>
                      <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                        {METHOD_LABELS[selectedMethod] ?? selectedMethod}
                        {selectedMethod === 'momo' && momoNetwork ? ` · ${MOMO_NETWORKS.find(n => n.key === momoNetwork)?.label ?? ''}` : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>Event</span>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500, textAlign: 'right' }}>
                      {selectedEvent?.name ?? '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Date</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#374151' }}>
                      {transactionDate || '—'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5, marginTop: 12 }}>
                A receipt is available to print after saving.
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Save Bar */}
        <div style={{ position: 'fixed', bottom: 0, left: 220, right: 0, background: 'var(--dm-bg-card)', borderTop: '0.5px solid var(--dm-border)', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
          <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', flex: 1 }}>
            {Object.keys(errors).length > 0 ? 'Please fix errors before saving' : 'Ready to save'}
          </span>
          <button
            type="button"
            className="rg-action-btn"
            onClick={() => navigate('/donations')}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer', transition: 'background 0.12s' }}
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: submitting ? '#A5B4FC' : '#4F6BED', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {submitting ? 'Saving…' : isCollective ? 'Save Offering' : 'Save Giving'}
          </button>
        </div>

        <div style={{ height: 64 }} />
      </form>
    </>
  )
}

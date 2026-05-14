import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ───────────────────────────────────────────────────────────────────

const pledgeSchema = z.object({
  member_id:    z.string().min(1, 'Please select a member'),
  category_id:  z.string().min(1, 'Please select a category'),
  total_amount: z.number().min(1, 'Amount must be greater than 0'),
  due_date:     z.string().optional(),
  notes:        z.string().optional(),
})

type FormValues = z.infer<typeof pledgeSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbMember   { id: string; first_name: string; last_name: string; member_number: string }
interface DbCategory { id: string; name: string }
interface DbBranch   { id: string; name: string }

// ─── Main Component ───────────────────────────────────────────────────────────

export function AddPledgePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [members,    setMembers]    = useState<DbMember[]>([])
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [branches,   setBranches]   = useState<DbBranch[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting,  setSubmitting]  = useState(false)

  const [memberSearch,       setMemberSearch]       = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(pledgeSchema),
  })

  const selectedMemberId = watch('member_id')
  const selectedMember   = members.find(m => m.id === selectedMemberId)
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
      const [memRes, catRes, branchRes] = await Promise.all([
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
      ])
      if (!memRes.error)    setMembers((memRes.data ?? []) as DbMember[])
      if (!catRes.error)    setCategories((catRes.data ?? []) as DbCategory[])
      if (!branchRes.error) setBranches((branchRes.data ?? []) as DbBranch[])
      setDataLoading(false)
    }
    load()
  }, [user?.org_id])

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setSubmitting(true)
    const branchId = user.branch_id ?? branches[0]?.id
    const { error } = await supabase.from('pledges').insert({
      org_id:       user.org_id,
      branch_id:    branchId,
      member_id:    data.member_id,
      category_id:  data.category_id,
      total_amount: data.total_amount,
      amount_paid:  0,
      currency:     'GHS',
      due_date:     data.due_date || null,
      notes:        data.notes || null,
      status:       'active',
    })
    setSubmitting(false)
    if (!error) {
      toast.success('Pledge recorded successfully')
      navigate('/donations/pledges')
    } else {
      toast.error(error.message)
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#fff', border: '0.5px solid #E5E7EB',
    borderRadius: 12, padding: 20, marginBottom: 16,
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: '#9CA3AF', marginBottom: 14,
  }

  const fieldLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12, fontWeight: 500, color: '#374151',
    display: 'block', marginBottom: 6,
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 38, borderRadius: 8,
    border: '0.5px solid #E5E7EB', background: '#fff',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: '#111827', padding: '0 12px',
    boxSizing: 'border-box', outline: 'none',
    transition: 'border-color 0.15s',
  }

  const errorStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 11.5, color: '#EF4444', marginTop: 4,
  }

  return (
    <>
      <style>{`
        .ap-input:focus { border-color: #4F6BED !important; }
        .ap-select:focus { border-color: #4F6BED !important; outline: none; }
        .ap-member:hover { background: #F4F5F7 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/donations/pledges')}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '0.5px solid #E5E7EB', background: '#fff',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: '#6B7280', flexShrink: 0,
          }}
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 20, color: '#111827',
            letterSpacing: '-0.015em', margin: 0,
          }}>
            Add Pledge
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280', margin: '2px 0 0',
          }}>
            Record a giving commitment for a member
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ maxWidth: 600 }}>

          {/* Member */}
          <div style={card}>
            <div style={sectionLabel}>Member</div>
            <label style={fieldLabel}>Member *</label>
            {selectedMember ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                height: 38, padding: '0 10px',
                border: '1.5px solid #4F6BED', borderRadius: 8,
                background: '#EEF1FE',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#4F6BED', color: '#fff',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                </div>
                <span style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 13, color: '#1B2352', flex: 1,
                }}>
                  {selectedMember.first_name} {selectedMember.last_name}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280' }}>
                  {selectedMember.member_number}
                </span>
                <button
                  type="button"
                  onClick={() => { setValue('member_id', ''); setMemberSearch('') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9CA3AF', padding: 2, display: 'grid', placeItems: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="ap-input"
                  type="text"
                  placeholder={dataLoading ? 'Loading members…' : 'Search by name or member ID…'}
                  value={memberSearch}
                  disabled={dataLoading}
                  onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true) }}
                  onFocus={() => setMemberDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                  style={inputBase}
                />
                {memberDropdownOpen && filteredMembers.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4,
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {filteredMembers.map(m => (
                      <div
                        key={m.id}
                        className="ap-member"
                        onMouseDown={() => {
                          setValue('member_id', m.id, { shouldValidate: true })
                          setMemberSearch('')
                          setMemberDropdownOpen(false)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', cursor: 'pointer', background: '#fff',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#E8ECF9', color: '#4F6BED',
                          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                          fontWeight: 700, fontSize: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>
                            {m.first_name} {m.last_name}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                            {m.member_number}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.member_id && <div style={errorStyle}>{errors.member_id.message}</div>}
          </div>

          {/* Pledge Details */}
          <div style={card}>
            <div style={sectionLabel}>Pledge Details</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Category *</label>
                <select
                  className="ap-select"
                  {...register('category_id')}
                  style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}
                >
                  <option value="">Select a category…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.category_id && <div style={errorStyle}>{errors.category_id.message}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Total Amount *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 16, fontWeight: 500, color: '#9CA3AF', pointerEvents: 'none',
                  }}>₵</span>
                  <input
                    className="ap-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...register('total_amount', { valueAsNumber: true })}
                    style={{
                      ...inputBase, paddingLeft: 28,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 16, fontWeight: 600,
                    }}
                  />
                </div>
                {errors.total_amount && <div style={errorStyle}>{errors.total_amount.message}</div>}
              </div>

              <div>
                <label style={fieldLabel}>Due Date (optional)</label>
                <input
                  className="ap-input"
                  type="date"
                  {...register('due_date')}
                  style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>

              <div>
                <label style={fieldLabel}>&nbsp;</label>
                <div style={{
                  height: 38, display: 'flex', alignItems: 'center',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 12, color: '#9CA3AF',
                }}>
                  Leave blank if open-ended
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={card}>
            <div style={sectionLabel}>Notes</div>
            <textarea
              className="ap-input"
              placeholder="Any additional notes about this pledge…"
              {...register('notes')}
              rows={3}
              style={{
                ...inputBase, height: 'auto', padding: '10px 12px',
                resize: 'vertical', lineHeight: 1.6,
              } as React.CSSProperties}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/donations/pledges')}
              style={{
                height: 38, padding: '0 18px', borderRadius: 8,
                border: '0.5px solid #E5E7EB', background: '#fff',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFE')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                height: 38, padding: '0 22px', borderRadius: 8,
                border: 'none', background: submitting ? '#A5B4FC' : '#4F6BED',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving…' : 'Save Pledge'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

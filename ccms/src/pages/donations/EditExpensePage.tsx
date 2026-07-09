import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Schema ───────────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  category_id:    z.string().min(1, 'Please select a category'),
  amount:         z.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['cash', 'momo', 'bank_transfer', 'cheque']),
  branch_id:      z.string().optional(),
  expense_date:   z.string().min(1, 'Please select a date'),
  notes:          z.string().optional(),
})

type FormValues = z.infer<typeof expenseSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbCategory { id: string; name: string }
interface DbBranch   { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

// Navy, Indigo, Periwinkle, Gold, Green, Teal — kept in sync with ExpensesPage's palette
const CATEGORY_PALETTE = [
  { dot: '#1B2352', bg: '#E9EAF3', color: '#1B2352' },
  { dot: '#4F6BED', bg: '#EEF1FE', color: '#3348C7' },
  { dot: '#7B93F5', bg: '#F0F1FE', color: '#5B63C7' },
  { dot: '#C8964A', bg: '#FEF6E5', color: '#8A6418' },
  { dot: '#22C55E', bg: '#DCFCE7', color: '#166534' },
  { dot: '#0F766E', bg: '#F0FDFA', color: '#0F766E' },
]

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', momo: 'MoMo', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryStyle(categoryId: string) {
  let hash = 0
  for (let i = 0; i < categoryId.length; i++) hash = categoryId.charCodeAt(i) + ((hash << 5) - hash)
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditExpensePage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [categories, setCategories] = useState<DbCategory[]>([])
  const [branches,   setBranches]   = useState<DbBranch[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  const {
    register, handleSubmit, setValue, watch, setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
  })

  const selectedCategoryId = watch('category_id')
  const selectedMethod     = watch('payment_method')
  const selectedCategory   = categories.find(c => c.id === selectedCategoryId)

  useEffect(() => {
    if (!user?.org_id || !id) return
    const load = async () => {
      setDataLoading(true)
      const [expRes, catRes, branchRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('category_id, amount, payment_method, branch_id, expense_date, notes')
          .eq('id', id)
          .single(),
        supabase.from('transaction_categories')
          .select('id, name')
          .eq('org_id', user.org_id)
          .eq('type', 'expense')
          .order('name'),
        supabase.from('branches')
          .select('id, name')
          .eq('org_id', user.org_id),
      ])

      if (!catRes.error)    setCategories((catRes.data ?? []) as DbCategory[])
      if (!branchRes.error) setBranches((branchRes.data ?? []) as DbBranch[])

      if (!expRes.error && expRes.data) {
        const e = expRes.data as {
          category_id: string | null; amount: number; payment_method: string;
          branch_id: string; expense_date: string; notes: string | null;
        }
        if (e.category_id) setValue('category_id', e.category_id)
        setValue('amount', e.amount)
        setValue('payment_method', e.payment_method as FormValues['payment_method'])
        setValue('branch_id', e.branch_id)
        setValue('expense_date', e.expense_date)
        if (e.notes) setValue('notes', e.notes)
      }

      setDataLoading(false)
    }
    load()
  }, [user?.org_id, id, setValue])

  useEffect(() => {
    if (!categoryDropdownOpen) return
    function close(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [categoryDropdownOpen])

  const onSubmit = async (data: FormValues) => {
    if (!user || !id) return

    if (isSuperAdmin && !data.branch_id) {
      setError('branch_id', { message: 'Please select a branch' })
      return
    }

    setSubmitting(true)
    const branchId = isSuperAdmin ? data.branch_id : user.branch_id
    const { error } = await supabase
      .from('expenses')
      .update({
        category_id:    data.category_id,
        amount:         data.amount,
        payment_method: data.payment_method,
        branch_id:      branchId,
        expense_date:   data.expense_date,
        notes:          data.notes || null,
      })
      .eq('id', id)
    setSubmitting(false)
    if (!error) {
      toast.success('Expense updated')
      navigate('/donations/expenses')
    } else {
      toast.error(error.message)
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

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

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#9CA3AF' }}>
          Loading…
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .ex-input:focus { border-color: #4F6BED !important; }
        .ex-select:focus { border-color: #4F6BED !important; outline: none; }
        .ex-cat-option:hover { background: var(--dm-bg-muted) !important; }
        .ex-method-pill:hover { opacity: 0.85; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/donations/expenses')}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: 'var(--dm-text-secondary)', flexShrink: 0,
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
            Edit Expense
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280', margin: '2px 0 0',
          }}>
            Update the details of this expense
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ maxWidth: 600 }}>

          {/* Expense Details */}
          <div style={card}>
            <div style={sectionLabel}>Expense Details</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Category *</label>
                <div ref={categoryRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(o => !o)}
                    style={{
                      ...inputBase, display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedCategory && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getCategoryStyle(selectedCategory.id).dot, flexShrink: 0 }} />
                      )}
                      <span style={{ color: selectedCategory ? 'var(--dm-text-ink)' : '#9CA3AF' }}>
                        {selectedCategory ? selectedCategory.name : 'Select a category…'}
                      </span>
                    </span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {categoryDropdownOpen && categories.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4,
                      maxHeight: 240, overflowY: 'auto',
                    }}>
                      {categories.map(c => {
                        const s = getCategoryStyle(c.id)
                        return (
                          <div
                            key={c.id}
                            className="ex-cat-option"
                            onClick={() => {
                              setValue('category_id', c.id, { shouldValidate: true })
                              setCategoryDropdownOpen(false)
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '10px 12px', cursor: 'pointer',
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                              fontSize: 13, color: '#111827',
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                            {c.name}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {errors.category_id && <div style={errorStyle}>{errors.category_id.message}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Amount *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 16, fontWeight: 500, color: '#9CA3AF', pointerEvents: 'none',
                  }}>₵</span>
                  <input
                    className="ex-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    {...register('amount', { valueAsNumber: true })}
                    style={{
                      ...inputBase, paddingLeft: 28,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 16, fontWeight: 600,
                    }}
                  />
                </div>
                {errors.amount && <div style={errorStyle}>{errors.amount.message}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Payment Method *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {(['cash', 'momo', 'bank_transfer', 'cheque'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      className="ex-method-pill"
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
              </div>

              {isSuperAdmin && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Branch *</label>
                  <select
                    className="ex-select"
                    {...register('branch_id')}
                    style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}
                  >
                    <option value="">Select a branch…</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {errors.branch_id && <div style={errorStyle}>{errors.branch_id.message}</div>}

                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    marginTop: 10, padding: '10px 12px', borderRadius: 8,
                    background: '#E8ECF9',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="8" cy="8" r="6.5" stroke="#4F6BED" strokeWidth="1.4" />
                      <path d="M8 7.2v3.8M8 5.2v.1" stroke="#4F6BED" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      Super Admin only. This field is hidden for Branch Admins and Finance Officers — their expenses are recorded against their own branch automatically.
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label style={fieldLabel}>Date *</label>
                <input
                  className="ex-input"
                  type="date"
                  {...register('expense_date')}
                  style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }}
                />
                {errors.expense_date && <div style={errorStyle}>{errors.expense_date.message}</div>}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={card}>
            <div style={sectionLabel}>Notes</div>
            <textarea
              className="ex-input"
              placeholder="e.g. July electricity bill"
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
              onClick={() => navigate('/donations/expenses')}
              style={{
                height: 38, padding: '0 18px', borderRadius: 8,
                border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
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
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

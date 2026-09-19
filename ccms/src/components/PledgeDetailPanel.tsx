import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MemberAvatar } from './MemberAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PledgePanelData {
  id: string
  total_amount: number
  amount_paid: number
  due_date: string | null
  status: 'active' | 'fulfilled' | 'overdue' | 'cancelled'
  notes: string | null
  category: { id: string; name: string } | null
  member: {
    id: string
    first_name: string
    last_name: string
    member_number: string
    photo_url: string | null
  } | null
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: 'cash' | 'momo' | 'bank_transfer' | 'cheque'
  reference_number: string | null
  notes: string | null
}

interface Props {
  pledge: PledgePanelData | null
  onClose: () => void
  onChanged: () => void  // parent re-fetches list after any change
  openDeletePrompt?: boolean  // if true, pop the delete-pledge confirmation on mount
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFullDate(dateStr: string | null) {
  if (!dateStr) return 'Open-ended'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const METHOD_LABEL: Record<Payment['payment_method'], string> = {
  cash: 'Cash', momo: 'MoMo', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PledgeDetailPanel({ pledge, onClose, onChanged, openDeletePrompt }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOpen = pledge !== null

  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  // Record-payment form state
  const [showForm, setShowForm]           = useState(false)
  const [amount, setAmount]               = useState<string>('')
  const [payDate, setPayDate]             = useState<string>(() => new Date().toISOString().split('T')[0])
  const [method, setMethod]               = useState<Payment['payment_method']>('cash')
  const [reference, setReference]         = useState('')
  const [payNotes, setPayNotes]           = useState('')
  const [saving, setSaving]               = useState(false)

  // Delete confirmations
  const [confirmDeletePledge, setConfirmDeletePledge]   = useState(false)
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadPayments = useCallback(async () => {
    if (!pledge) return
    setLoadingPayments(true)
    const { data, error } = await supabase
      .from('pledge_payments')
      .select('id, amount, payment_date, payment_method, reference_number, notes')
      .eq('pledge_id', pledge.id)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Could not load payment history')
      setPayments([])
    } else {
      setPayments((data ?? []) as Payment[])
    }
    setLoadingPayments(false)
  }, [pledge])

  useEffect(() => {
    if (pledge) {
      loadPayments()
      if (openDeletePrompt) setConfirmDeletePledge(true)
    } else {
      // reset form on close
      setShowForm(false); setAmount(''); setReference(''); setPayNotes(''); setMethod('cash')
      setConfirmDeletePledge(false); setConfirmDeletePayment(null)
    }
  }, [pledge, loadPayments, openDeletePrompt])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!pledge) return null

  const balance     = Math.max(0, pledge.total_amount - pledge.amount_paid)
  const numAmount   = Number(amount || 0)
  const isOverflow  = numAmount > 0 && numAmount > balance
  const overflowBy  = Math.max(0, numAmount - balance)

  // ── Handlers ──

  const savePayment = async () => {
    if (!user) return
    if (!numAmount || numAmount <= 0) { toast.error('Enter an amount greater than 0'); return }
    if (!payDate) { toast.error('Pick a payment date'); return }

    setSaving(true)
    const { error } = await supabase.from('pledge_payments').insert({
      org_id:           user.org_id,
      branch_id:        user.branch_id ?? null,
      pledge_id:        pledge.id,
      amount:           numAmount,
      payment_date:     payDate,
      payment_method:   method,
      reference_number: reference || null,
      notes:            payNotes || null,
      recorded_by:      user.id,
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Payment recorded')
    setShowForm(false)
    setAmount(''); setReference(''); setPayNotes(''); setMethod('cash')
    setPayDate(new Date().toISOString().split('T')[0])
    await loadPayments()
    onChanged()
  }

  const deletePayment = async (paymentId: string) => {
    setDeleting(true)
    const { error } = await supabase.from('pledge_payments').delete().eq('id', paymentId)
    setDeleting(false)
    setConfirmDeletePayment(null)
    if (error) { toast.error(error.message); return }
    toast.success('Payment removed')
    await loadPayments()
    onChanged()
  }

  const deletePledge = async () => {
    setDeleting(true)
    const { error } = await supabase.from('pledges').delete().eq('id', pledge.id)
    setDeleting(false)
    setConfirmDeletePledge(false)
    if (error) { toast.error(error.message); return }
    toast.success('Pledge deleted. Recorded payments kept in Transactions.')
    onChanged()
    onClose()
  }

  // ── Styles ──

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)',
    zIndex: 90, opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s',
    backdropFilter: 'blur(1px)',
  }

  const panel: React.CSSProperties = {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(480px, 100%)',
    background: 'var(--dm-bg-card)',
    borderLeft: '0.5px solid var(--dm-border)',
    boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.06)',
    zIndex: 91, display: 'flex', flexDirection: 'column',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.25s ease',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  }

  const label: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--dm-text-muted)', fontWeight: 600,
  }
  const value: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14, color: 'var(--dm-text-ink)', fontWeight: 600, marginTop: 4,
  }
  const input: React.CSSProperties = {
    width: '100%', height: 36, boxSizing: 'border-box',
    borderRadius: 8, border: '0.5px solid var(--dm-border)',
    background: 'var(--dm-bg-card)', color: 'var(--dm-text-ink)',
    padding: '0 12px', fontSize: 13,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", outline: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#4F6BED', color: '#fff', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const btnSecondary: React.CSSProperties = {
    height: 36, padding: '0 14px', borderRadius: 8,
    border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
    color: 'var(--dm-text-body)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const btnDanger: React.CSSProperties = {
    height: 36, padding: '0 14px', borderRadius: 8,
    border: '0.5px solid #FCA5A5', background: 'var(--dm-bg-card)',
    color: '#DC2626', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  }

  // ── Render ──

  return (
    <>
      <div style={overlay} onClick={onClose} aria-hidden={!isOpen} />
      <aside style={panel} role="dialog" aria-label="Pledge details">
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '0.5px solid var(--dm-border-soft)',
        }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--dm-text-ink)' }}>
            Pledge details
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
              color: 'var(--dm-text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {/* Member header */}
          {pledge.member && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <MemberAvatar
                firstName={pledge.member.first_name}
                lastName={pledge.member.last_name}
                photoUrl={pledge.member.photo_url}
                size={48}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--dm-text-ink)' }}>
                  {pledge.member.first_name} {pledge.member.last_name}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: 'var(--dm-text-secondary)', marginTop: 2 }}>
                  {pledge.member.member_number}
                </div>
              </div>
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18, fontSize: 12.5, color: 'var(--dm-text-secondary)' }}>
            <div><span style={{ color: 'var(--dm-text-muted)' }}>Category</span> · {pledge.category?.name ?? '—'}</div>
            <div><span style={{ color: 'var(--dm-text-muted)' }}>Due</span> · {formatFullDate(pledge.due_date)}</div>
          </div>

          {/* Pledged / Paid / Balance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { l: 'Pledged', v: formatAmount(pledge.total_amount) },
              { l: 'Paid',    v: formatAmount(pledge.amount_paid) },
              { l: 'Balance', v: formatAmount(balance) },
            ].map(x => (
              <div key={x.l} style={{ background: 'var(--dm-bg-muted)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ ...label, fontSize: 10 }}>{x.l}</div>
                <div style={value}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {!showForm && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              <button
                style={btnPrimary}
                onClick={() => setShowForm(true)}
                disabled={pledge.status === 'cancelled'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Record payment
              </button>
              <button
                style={btnSecondary}
                onClick={() => navigate(`/donations/pledges/${pledge.id}/edit`)}
              >
                Edit
              </button>
              <button
                style={btnDanger}
                onClick={() => setConfirmDeletePledge(true)}
              >
                Delete pledge
              </button>
            </div>
          )}

          {/* Record payment form */}
          {showForm && (
            <div style={{
              border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 16,
              marginBottom: 22, background: 'var(--dm-bg-card)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Record payment</div>
              <div style={{ fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 14 }}>
                Balance remaining {formatAmount(balance)}
              </div>

              <label style={{ ...label, fontSize: 11, display: 'block', marginBottom: 4 }}>Amount *</label>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: 'var(--dm-text-muted)',
                }}>₵</span>
                <input
                  type="number" step="0.01" min="0"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...input, paddingLeft: 26, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}
                />
              </div>

              {isOverflow && (
                <div style={{
                  background: '#FEF3C7', color: '#92400E', borderRadius: 8,
                  padding: '8px 10px', fontSize: 12, marginBottom: 10,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M8 6v3M8 11v.5M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>This is {formatAmount(overflowBy)} more than the balance. Check the amount before saving.</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ ...label, fontSize: 11, display: 'block', marginBottom: 4 }}>Date *</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={input} />
                </div>
                <div>
                  <label style={{ ...label, fontSize: 11, display: 'block', marginBottom: 4 }}>Method</label>
                  <select value={method} onChange={e => setMethod(e.target.value as Payment['payment_method'])} style={{ ...input, cursor: 'pointer' }}>
                    <option value="cash">Cash</option>
                    <option value="momo">MoMo</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <label style={{ ...label, fontSize: 11, display: 'block', marginBottom: 4 }}>Reference (optional)</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. MoMo transaction ID" style={{ ...input, marginBottom: 10 }} />

              <label style={{ ...label, fontSize: 11, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
              <textarea
                value={payNotes} onChange={e => setPayNotes(e.target.value)}
                rows={2}
                style={{ ...input, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }}
              />

              <div style={{ fontSize: 11.5, color: 'var(--dm-text-secondary)', marginBottom: 12 }}>
                Also recorded as income under Transactions.
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={savePayment} disabled={saving}>
                  {saving ? 'Saving…' : 'Save payment'}
                </button>
              </div>
            </div>
          )}

          {/* Payment history */}
          <div style={{ ...label, marginBottom: 8 }}>Payment history</div>
          {loadingPayments ? (
            <div style={{ fontSize: 13, color: 'var(--dm-text-muted)', padding: '10px 0' }}>Loading…</div>
          ) : payments.length === 0 ? (
            <div style={{
              fontSize: 13, color: 'var(--dm-text-muted)', padding: '14px 0',
              borderTop: '0.5px solid var(--dm-border-soft)',
            }}>
              No payments recorded yet.
            </div>
          ) : (
            payments.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderTop: '0.5px solid var(--dm-border-soft)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--dm-text-ink)' }}>
                    {formatFullDate(p.payment_date)} · {METHOD_LABEL[p.payment_method]}
                  </div>
                  {p.reference_number && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)', marginTop: 2 }}>
                      {p.reference_number}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--dm-text-ink)' }}>
                  {formatAmount(p.amount)}
                </div>
                <button
                  aria-label="Delete payment"
                  onClick={() => setConfirmDeletePayment(p.id)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--dm-text-muted)',
                    display: 'grid', placeItems: 'center', cursor: 'pointer',
                  }}
                  title="Delete payment"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 4h9M5.5 4V2.5h3V4M4 4l.5 8h5L10 4M6 6.5v3M8 6.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Delete pledge confirmation */}
        {confirmDeletePledge && (
          <ConfirmSheet
            title="Delete this pledge?"
            body={
              payments.length > 0
                ? `${payments.length} recorded payment${payments.length === 1 ? '' : 's'} (${formatAmount(pledge.amount_paid)}) will stay in Transactions as ordinary giving.`
                : 'No payments have been recorded on this pledge.'
            }
            confirmLabel={deleting ? 'Deleting…' : 'Delete pledge'}
            onConfirm={deletePledge}
            onCancel={() => setConfirmDeletePledge(false)}
            danger
          />
        )}

        {/* Delete payment confirmation */}
        {confirmDeletePayment && (
          <ConfirmSheet
            title="Delete this payment?"
            body="The matching entry under Transactions is also removed. The pledge's progress will update."
            confirmLabel={deleting ? 'Deleting…' : 'Delete payment'}
            onConfirm={() => deletePayment(confirmDeletePayment)}
            onCancel={() => setConfirmDeletePayment(null)}
            danger
          />
        )}
      </aside>
    </>
  )
}

// ─── Confirmation sheet ───────────────────────────────────────────────────────

function ConfirmSheet({
  title, body, confirmLabel, onConfirm, onCancel, danger,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 5,
    }}>
      <div style={{
        background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)',
        borderRadius: 12, padding: 20, maxWidth: 380, width: '100%',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--dm-text-ink)', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dm-text-body)', lineHeight: 1.5, marginBottom: 18 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
              color: 'var(--dm-text-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8, border: 'none',
              background: danger ? '#DC2626' : '#4F6BED', color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

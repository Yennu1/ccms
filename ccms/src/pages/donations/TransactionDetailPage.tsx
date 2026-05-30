import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TxDetail {
  id: string
  amount: number
  payment_method: string
  transaction_date: string
  reference_number: string | null
  notes: string | null
  branch_id: string | null
  member_id: string | null
  category_id: string | null
  event_id: string | null
  created_at: string
  transaction_categories: { id: string; name: string } | null
  member: { id: string; first_name: string; last_name: string; member_number: string } | null
  branches: { id: string; name: string } | null
  events: { id: string; name: string; starts_at: string } | null
  recorder: { id: string; full_name: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  tithe:        { bg: 'var(--cat-tithe-bg)',        color: 'var(--cat-tithe-fg)',        dot: 'var(--cat-tithe-dot)',        label: 'Tithe' },
  offering:     { bg: 'var(--cat-offering-bg)',     color: 'var(--cat-offering-fg)',     dot: 'var(--cat-offering-dot)',     label: 'Offering' },
  building:     { bg: 'var(--cat-building-bg)',     color: 'var(--cat-building-fg)',     dot: 'var(--cat-building-dot)',     label: 'Building Fund' },
  welfare:      { bg: 'var(--cat-welfare-bg)',      color: 'var(--cat-welfare-fg)',      dot: 'var(--cat-welfare-dot)',      label: 'Welfare' },
  thanksgiving: { bg: 'var(--cat-thanksgiving-bg)', color: 'var(--cat-thanksgiving-fg)', dot: 'var(--cat-thanksgiving-dot)', label: 'Thanksgiving' },
  special:      { bg: 'var(--cat-special-bg)',      color: 'var(--cat-special-fg)',      dot: 'var(--cat-special-dot)',      label: 'Special Offering' },
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', bank: 'Bank Transfer', cheque: 'Cheque',
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(firstName: string, lastName: string) {
  const str = (firstName + lastName).toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GH', {
      month: 'short', day: '2-digit', year: 'numeric',
    })
  } catch { return dateStr }
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('en-GH', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

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

function calculateStreak(txDates: string[]): number {
  const now = new Date()
  let streak = 0
  for (let i = 0; i < 12; i++) {
    const monthStr = new Date(now.getFullYear(), now.getMonth() - i, 1)
      .toISOString().slice(0, 7)
    if (txDates.some(d => d.startsWith(monthStr))) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransactionDetailPage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()

  const [tx,        setTx]        = useState<TxDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [ytdTotal,  setYtdTotal]  = useState(0)
  const [streak,    setStreak]    = useState(0)
  const [history,   setHistory]   = useState<{ month: string; amount: number }[]>([])
  const [deleting,  setDeleting]  = useState(false)

  useEffect(() => {
    if (!id || !user) return
    const fetchTransaction = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, amount, payment_method, transaction_date, reference_number,
          notes, branch_id, member_id, category_id, event_id, created_at,
          transaction_categories(id, name),
          member:members!transactions_member_id_fkey(id, first_name, last_name, member_number),
          branches(id, name),
          events(id, name, starts_at),
          recorder:profiles!transactions_recorded_by_fkey(id, full_name)
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const txData = data as unknown as TxDetail
      setTx(txData)

      // Fetch member stats if we have a member
      if (txData.member_id) {
        const yearStart = `${new Date().getFullYear()}-01-01`
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
        const sixMonthsAgoStr = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1)
          .toISOString().split('T')[0]

        const [ytdRes, histRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount')
            .eq('org_id', user.org_id)
            .eq('member_id', txData.member_id)
            .gte('transaction_date', yearStart),
          supabase
            .from('transactions')
            .select('amount, transaction_date')
            .eq('org_id', user.org_id)
            .eq('member_id', txData.member_id)
            .gte('transaction_date', sixMonthsAgoStr)
            .order('transaction_date', { ascending: true }),
        ])

        if (!ytdRes.error) {
          setYtdTotal((ytdRes.data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0))
        }

        if (!histRes.error && histRes.data) {
          // Build per-month totals for last 6 months
          const grouped: Record<string, number> = {}
          const dates: string[] = []
          histRes.data.forEach((r: { amount: number; transaction_date: string }) => {
            const mo = r.transaction_date.slice(0, 7)
            grouped[mo] = (grouped[mo] ?? 0) + r.amount
            dates.push(r.transaction_date)
          })
          const monthsArr: { month: string; amount: number }[] = []
          for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const key = d.toISOString().slice(0, 7)
            const label = d.toLocaleDateString('en-GH', { month: 'short' })
            monthsArr.push({ month: label, amount: grouped[key] ?? 0 })
          }
          setHistory(monthsArr)
          setStreak(calculateStreak(dates))
        }
      }

      setLoading(false)
    }
    fetchTransaction()
  }, [id, user])

  const handleDelete = async () => {
    if (!tx || !window.confirm('Delete this transaction? This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Transaction deleted')
      navigate('/donations')
    }
  }

  const handleEmailReceipt = () => {
    if (!tx) return
    const memberName = tx.member
      ? `${tx.member.first_name} ${tx.member.last_name}`
      : 'Anonymous'
    const catName = tx.transaction_categories?.name ?? '—'
    const body = encodeURIComponent(
      `OFFICIAL GIVING RECEIPT\n\nHILLTOP CHURCH\n\nMember: ${memberName}\nCategory: ${catName}\nAmount: ${formatAmount(tx.amount)}\nDate: ${formatDate(tx.transaction_date)}\nReference: ${tx.reference_number ?? tx.id}\n\nGod loves a cheerful giver. Thank you for your faithfulness.`
    )
    window.location.href = `mailto:?subject=Giving Receipt — ${formatDate(tx.transaction_date)}&body=${body}`
  }

  const printStyles = `
  @media print {
    body * { visibility: hidden !important; }
    #print-only-receipt { display: block !important; }
    #print-only-receipt,
    #print-only-receipt * { visibility: visible !important; }
    #print-only-receipt {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      padding: 40px !important;
      background: white !important;
    }
  }
`

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 12,
    padding: '10px 0', borderBottom: '0.5px solid var(--dm-border-subtle)',
  }
  const rowLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12.5, color: 'var(--dm-text-muted)', flexShrink: 0,
  }
  const rowValue: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12.5, color: 'var(--dm-text-body)', fontWeight: 500,
    textAlign: 'right',
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
          Loading transaction…
        </div>
      </div>
    )
  }

  if (notFound || !tx) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--dm-text-ink)', marginBottom: 8 }}>
          Transaction not found
        </div>
        <button
          onClick={() => navigate('/donations')}
          style={{
            height: 36, padding: '0 16px', borderRadius: 8,
            border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer',
          }}
        >
          Back to Donations
        </button>
      </div>
    )
  }

  const catName = tx.transaction_categories?.name ?? ''
  const catKey  = getCatKey(catName)
  const cat     = CAT_STYLE[catKey] ?? CAT_STYLE.offering
  const firstName = tx.member?.first_name ?? 'Anonymous'
  const lastName  = tx.member?.last_name ?? ''
  const { bg: avBg, color: avColor } = getAvatarColor(firstName, lastName)
  const initials = `${firstName[0] ?? 'A'}${lastName[0] ?? ''}`.toUpperCase()
  const maxHistory = Math.max(...history.map(h => h.amount), 1)

  return (
    <>
      <style>{`
        .td-action:hover { background: var(--dm-bg-surface) !important; border-color: var(--dm-border-strong) !important; }
        .td-del:hover { background: var(--badge-deceased-bg) !important; border-color: var(--badge-deceased-dot) !important; color: var(--badge-deceased-fg) !important; }
      `}</style>
      <style>{printStyles}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/donations')}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: 'var(--dm-text-secondary)', flexShrink: 0,
          }}
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 20, color: 'var(--dm-text-ink)',
            letterSpacing: '-0.015em', margin: 0,
          }}>
            Transaction
          </h1>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)', margin: '2px 0 0' }}>
            {tx.reference_number ?? tx.id}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="td-action"
            onClick={() => navigate(`/donations/${id}/edit`)}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
          <button
            className="td-action"
            onClick={handleEmailReceipt}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: 'var(--dm-text-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M1.5 5l6.5 4.5L14.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Send Receipt
          </button>
          <button
            className="td-del"
            disabled={deleting}
            onClick={handleDelete}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-card)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: 'var(--dm-text-secondary)',
              cursor: deleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Left ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Transaction Details card */}
          <div style={{
            background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Amount hero */}
            <div style={{
              padding: '24px 24px 20px',
              background: 'var(--dm-bg-surface)',
              borderBottom: '0.5px solid var(--dm-border-soft)',
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 10.5, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--dm-text-muted)', marginBottom: 6,
                }}>
                  Amount
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 36, color: 'var(--dm-text-ink)',
                  letterSpacing: '-0.025em', lineHeight: 1.05,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatAmount(tx.amount)}
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: cat.bg, color: cat.color,
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 11.5,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.dot }} />
                    {catName || cat.label}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 9px', borderRadius: 999,
                    background: 'var(--dm-bg-muted)', color: 'var(--dm-text-secondary)',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 11.5,
                  }}>
                    {METHOD_LABELS[tx.payment_method] ?? tx.payment_method}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{
                  background: 'var(--badge-active-bg)', color: 'var(--badge-active-fg)',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 11.5,
                  padding: '4px 10px', borderRadius: 999,
                }}>
                  Confirmed
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
                  {tx.reference_number ?? tx.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Detail rows */}
            <div style={{ padding: '4px 24px 8px' }}>
              <div style={rowStyle}>
                <span style={rowLabel}>Date</span>
                <span style={{ ...rowValue, fontFamily: "'IBM Plex Mono', monospace" }}>{formatDate(tx.transaction_date)}</span>
              </div>
              {tx.events && (
                <div style={rowStyle}>
                  <span style={rowLabel}>Event</span>
                  <span style={rowValue}>{tx.events.name}</span>
                </div>
              )}
              {tx.branches && (
                <div style={rowStyle}>
                  <span style={rowLabel}>Branch</span>
                  <span style={rowValue}>{tx.branches.name}</span>
                </div>
              )}
              <div style={rowStyle}>
                <span style={rowLabel}>Member</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tx.member ? (
                    <>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: avBg, color: avColor,
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        fontWeight: 700, fontSize: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {initials}
                      </div>
                      <span style={rowValue}>{firstName} {lastName}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
                        {tx.member.member_number}
                      </span>
                    </>
                  ) : (
                    <span style={rowValue}>Anonymous</span>
                  )}
                </div>
              </div>
              {tx.notes && (
                <div style={rowStyle}>
                  <span style={rowLabel}>Notes</span>
                  <span style={{ ...rowValue, maxWidth: 300 }}>{tx.notes}</span>
                </div>
              )}
              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <span style={rowLabel}>Recorded by</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={rowValue}>{tx.recorder?.full_name ?? '—'}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)', marginTop: 1 }}>
                    {formatDateTime(tx.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Giving history card */}
          {history.some(h => h.amount > 0) && (
            <div style={{
              background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)', marginBottom: 4,
              }}>
                Giving History
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 16,
              }}>
                Last 6 months
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: '100%',
                      background: i === history.length - 1 ? '#4F6BED' : 'var(--avatar-1-bg)',
                      borderRadius: 4,
                      height: h.amount > 0 ? `${Math.round((h.amount / maxHistory) * 48) + 8}px` : '4px',
                    }} />
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 10, color: 'var(--dm-text-muted)' }}>
                      {h.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Receipt card */}
          <div style={{
            background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px 14px',
              borderBottom: '1.5px dashed var(--dm-border-soft)',
              background: 'var(--dm-bg-surface)',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--dm-text-muted)', marginBottom: 4,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>HILLTOP CHURCH</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {tx.reference_number ?? tx.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 9, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--dm-text-muted)', marginBottom: 12,
              }}>
                OFFICIAL GIVING RECEIPT
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontWeight: 700, fontSize: 26, color: 'var(--dm-text-ink)',
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
              }}>
                {formatAmount(tx.amount)}
              </div>
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Member</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
                  {tx.member ? `${firstName} ${lastName}` : 'Anonymous'}
                </span>
              </div>
              {tx.member && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Member No.</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
                    {tx.member.member_number}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Category</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
                  {catName || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Payment</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
                  {METHOD_LABELS[tx.payment_method] ?? tx.payment_method}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Date</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
                  {formatDate(tx.transaction_date)}
                </span>
              </div>
              <div style={{ borderTop: '1px dashed var(--dm-border-soft)', paddingTop: 10, marginTop: 2 }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 10.5, color: 'var(--dm-text-muted)', textAlign: 'center', lineHeight: 1.5,
                }}>
                  "God loves a cheerful giver." — Thank you for your faithfulness.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            style={{
              width: '100%',
              marginTop: 12,
              height: 38,
              borderRadius: 8,
              border: '0.5px solid var(--dm-border-soft)',
              background: 'var(--dm-bg-card)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--dm-text-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
  <path d="M4 5V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V5" stroke="currentColor" strokeWidth="1.3"/>
  <rect x="4" y="8" width="6" height="1" rx="0.5" fill="currentColor"/>
  <rect x="4" y="10" width="4" height="1" rx="0.5" fill="currentColor"/>
</svg>  Download / Print PDF
          </button>

          {/* Contributor card */}
          {tx.member && (
            <div style={{
              background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border-soft)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: 'var(--dm-text-muted)', marginBottom: 14,
              }}>
                Contributor
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: avBg, color: avColor,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 14, color: 'var(--dm-text-ink)',
                  }}>
                    {firstName} {lastName}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)', marginTop: 2 }}>
                    {tx.member.member_number}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--dm-bg-surface)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-muted)', marginBottom: 3 }}>
                    Giving Streak
                  </div>
                  <div style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontWeight: 700, fontSize: 20, color: 'var(--dm-text-ink)',
                  }}>
                    {streak}
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dm-text-secondary)', marginLeft: 3 }}>mo</span>
                  </div>
                </div>
                <div style={{ background: 'var(--dm-bg-surface)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--dm-text-muted)', marginBottom: 3 }}>
                    Total Given YTD
                  </div>
                  <div style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontWeight: 700, fontSize: 16, color: 'var(--dm-text-ink)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatAmount(ytdTotal)}
                  </div>
                </div>
              </div>

              {/* Streak dots */}
              <div>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: 'var(--dm-text-secondary)', marginBottom: 8 }}>
                  Consecutive months
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: i < streak ? '#4F6BED' : 'var(--dm-border-strong)',
                        opacity: i < streak ? (0.4 + (i / Math.max(streak, 1)) * 0.6) : 1,
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate(`/members/${tx.member!.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 16, padding: 0,
                  background: 'none', border: 'none',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 13, color: '#4F6BED',
                  cursor: 'pointer',
                }}
              >
                View member profile
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden receipt for print only */}
      <div id="print-only-receipt" style={{ display: 'none' }}>
        <div style={{
          padding: '16px 20px 14px',
          borderBottom: '1.5px dashed #E5E7EB',
          background: 'var(--dm-bg-surface)',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--dm-text-muted)', marginBottom: 4,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>HILLTOP CHURCH</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {tx.reference_number ?? tx.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--dm-text-muted)', marginBottom: 12,
          }}>
            OFFICIAL GIVING RECEIPT
          </div>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 26, color: 'var(--dm-text-ink)',
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          }}>
            {formatAmount(tx.amount)}
          </div>
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Member</span>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
              {tx.member ? `${firstName} ${lastName}` : 'Anonymous'}
            </span>
          </div>
          {tx.member && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Member No.</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
                {tx.member.member_number}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Category</span>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
              {catName || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Payment</span>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-body)', fontWeight: 500 }}>
              {METHOD_LABELS[tx.payment_method] ?? tx.payment_method}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>Date</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-body)' }}>
              {formatDate(tx.transaction_date)}
            </span>
          </div>
          <div style={{ borderTop: '1px dashed #E5E7EB', paddingTop: 10, marginTop: 2 }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 10.5, color: 'var(--dm-text-muted)', textAlign: 'center', lineHeight: 1.5,
            }}>
              "God loves a cheerful giver." — Thank you for your faithfulness.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

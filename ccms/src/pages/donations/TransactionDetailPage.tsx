import { useNavigate, useParams } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'tithe' | 'offering' | 'building' | 'welfare' | 'thanksgiving' | 'special'
type Method = 'cash' | 'momo' | 'bank' | 'cheque'

interface TransactionDetail {
  id: string
  firstName: string
  lastName: string
  memberNumber: string
  category: Category
  amount: number
  method: Method
  momoNetwork?: string
  date: string
  event: string
  notes: string
  recordedBy: string
  createdAt: string
  givingStreak: number
  totalGiven: number
  givingHistory: { month: string; amount: number }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<Category, { bg: string; color: string; dot: string; label: string }> = {
  tithe:        { bg: '#FEF6E5', color: '#8A6418',  dot: '#C8964A', label: 'Tithe' },
  offering:     { bg: '#DCFCE7', color: '#166534',  dot: '#22C55E', label: 'Offering' },
  building:     { bg: '#E8ECF9', color: '#3349C7',  dot: '#7B93F5', label: 'Building Fund' },
  welfare:      { bg: '#EDE9FE', color: '#5B21B6',  dot: '#8B5CF6', label: 'Welfare' },
  thanksgiving: { bg: '#FFE4E6', color: '#9F1239',  dot: '#EF4444', label: 'Thanksgiving' },
  special:      { bg: '#FCE7F3', color: '#9D174D',  dot: '#EC4899', label: 'Special Offering' },
}

const METHOD_LABELS: Record<Method, string> = {
  cash:   'Cash',
  momo:   'Mobile Money',
  bank:   'Bank Transfer',
  cheque: 'Cheque',
}

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

function getAvatarColor(firstName: string, lastName: string) {
  const str = (firstName + lastName).toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatAmount(n: number) {
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Sample data keyed by transaction ID
const TRANSACTIONS: Record<string, TransactionDetail> = {
  'REF-001': {
    id: 'REF-001', firstName: 'Kwame', lastName: 'Asante', memberNumber: 'GH-00001',
    category: 'tithe', amount: 500, method: 'cash',
    date: 'May 04, 2026', event: 'Sunday Service — May 4, 2026',
    notes: 'Monthly tithe contribution.',
    recordedBy: 'Admin User', createdAt: 'May 04, 2026, 10:32 AM',
    givingStreak: 12, totalGiven: 14500,
    givingHistory: [
      { month: 'Nov', amount: 500 }, { month: 'Dec', amount: 500 },
      { month: 'Jan', amount: 500 }, { month: 'Feb', amount: 500 },
      { month: 'Mar', amount: 500 }, { month: 'Apr', amount: 500 },
    ],
  },
  'REF-002': {
    id: 'REF-002', firstName: 'Abena', lastName: 'Mensah', memberNumber: 'GH-00002',
    category: 'offering', amount: 200, method: 'momo', momoNetwork: 'MTN',
    date: 'May 04, 2026', event: 'Sunday Service — May 4, 2026',
    notes: '',
    recordedBy: 'Admin User', createdAt: 'May 04, 2026, 10:45 AM',
    givingStreak: 8, totalGiven: 5600,
    givingHistory: [
      { month: 'Nov', amount: 150 }, { month: 'Dec', amount: 200 },
      { month: 'Jan', amount: 180 }, { month: 'Feb', amount: 200 },
      { month: 'Mar', amount: 200 }, { month: 'Apr', amount: 200 },
    ],
  },
}

const FALLBACK: TransactionDetail = {
  id: 'REF-???', firstName: 'Unknown', lastName: 'Member', memberNumber: 'GH-00000',
  category: 'offering', amount: 0, method: 'cash',
  date: '—', event: '—', notes: '—',
  recordedBy: '—', createdAt: '—',
  givingStreak: 0, totalGiven: 0, givingHistory: [],
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransactionDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const tx = TRANSACTIONS[id ?? ''] ?? FALLBACK

  const cat = CATEGORY_STYLES[tx.category]
  const { bg: avBg, color: avColor } = getAvatarColor(tx.firstName, tx.lastName)
  const initials = `${tx.firstName[0]}${tx.lastName[0]}`

  const maxHistory = Math.max(...tx.givingHistory.map(h => h.amount), 1)

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 12,
    padding: '10px 0', borderBottom: '0.5px solid #F3F4F6',
  }
  const rowLabel: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12.5, color: '#9CA3AF', flexShrink: 0,
  }
  const rowValue: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 12.5, color: '#374151', fontWeight: 500,
    textAlign: 'right',
  }

  return (
    <>
      <style>{`
        .td-action:hover { background: #FAFBFE !important; border-color: #D1D5DB !important; }
        .td-void:hover { background: #FEE2E2 !important; border-color: #FCA5A5 !important; color: #DC2626 !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/donations')}
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
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 20, color: '#111827',
            letterSpacing: '-0.015em', margin: 0,
          }}>
            Transaction
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12, color: '#6B7280', margin: '2px 0 0',
          }}>
            {tx.id}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="td-action"
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M6 5h4M6 8h4M6 11h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Print Receipt
          </button>
          <button
            className="td-action"
            onClick={() => navigate('/donations/new')}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
          <button
            className="td-void"
            style={{
              height: 34, padding: '0 14px', borderRadius: 8,
              border: '0.5px solid #E5E7EB', background: '#fff',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13, color: '#6B7280', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            Void
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Left ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Transaction Details card */}
          <div style={{
            background: '#fff', border: '0.5px solid #E5E7EB',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Amount hero */}
            <div style={{
              padding: '24px 24px 20px',
              background: 'linear-gradient(135deg, #F8F9FF 0%, #F4F5F7 100%)',
              borderBottom: '0.5px solid #E5E7EB',
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 10.5, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6,
                }}>
                  Amount
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 36, color: '#111827',
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
                    {cat.label}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 9px', borderRadius: 999,
                    background: '#F3F4F6', color: '#6B7280',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 11.5,
                  }}>
                    {METHOD_LABELS[tx.method]}
                    {tx.method === 'momo' && tx.momoNetwork ? ` · ${tx.momoNetwork}` : ''}
                  </span>
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
              }}>
                <span style={{
                  background: '#DCFCE7', color: '#166534',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 11.5,
                  padding: '4px 10px', borderRadius: 999,
                }}>
                  Confirmed
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                  {tx.id}
                </span>
              </div>
            </div>

            {/* Detail rows */}
            <div style={{ padding: '4px 24px 8px' }}>
              <div style={rowStyle}>
                <span style={rowLabel}>Date</span>
                <span style={{ ...rowValue, fontFamily: "'IBM Plex Mono', monospace" }}>{tx.date}</span>
              </div>
              <div style={rowStyle}>
                <span style={rowLabel}>Event</span>
                <span style={rowValue}>{tx.event}</span>
              </div>
              <div style={rowStyle}>
                <span style={rowLabel}>Member</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: avBg, color: avColor,
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 700, fontSize: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {initials}
                  </div>
                  <span style={rowValue}>{tx.firstName} {tx.lastName}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                    {tx.memberNumber}
                  </span>
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
                  <div style={rowValue}>{tx.recordedBy}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {tx.createdAt}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Giving history card */}
          {tx.givingHistory.length > 0 && (
            <div style={{
              background: '#fff', border: '0.5px solid #E5E7EB',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4,
              }}>
                Giving History
              </div>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 12, color: '#6B7280', marginBottom: 16,
              }}>
                Last 6 months · {tx.category === 'tithe' ? 'Tithe' : 'Offering'} only
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
                {tx.givingHistory.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: '100%', background: i === tx.givingHistory.length - 1 ? '#4F6BED' : '#E8ECF9',
                      borderRadius: 4,
                      height: `${Math.round((h.amount / maxHistory) * 48) + 8}px`,
                    }} />
                    <span style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontSize: 10, color: '#9CA3AF',
                    }}>
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
            background: '#fff', border: '0.5px solid #E5E7EB',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Perforated top */}
            <div style={{
              padding: '16px 20px 14px',
              borderBottom: '1.5px dashed #E5E7EB',
              background: '#FAFBFE',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 12,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>Official Receipt</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{tx.id}</span>
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontWeight: 700, fontSize: 26, color: '#111827',
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
              }}>
                {formatAmount(tx.amount)}
              </div>
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>From</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {tx.firstName} {tx.lastName}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Purpose</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {cat.label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Payment</span>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {METHOD_LABELS[tx.method]}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Date</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#374151' }}>{tx.date}</span>
              </div>

              <div style={{ borderTop: '1px dashed #E5E7EB', paddingTop: 10, marginTop: 2 }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 10.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5,
                }}>
                  This receipt is issued by the church as confirmation of a voluntary contribution. Thank you for your faithfulness.
                </div>
              </div>
            </div>
          </div>

          {/* Contributor card */}
          <div style={{
            background: '#fff', border: '0.5px solid #E5E7EB',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: '#9CA3AF', marginBottom: 14,
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
                  fontWeight: 600, fontSize: 14, color: '#111827',
                }}>
                  {tx.firstName} {tx.lastName}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {tx.memberNumber}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{
                background: '#F4F5F7', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>
                  Giving Streak
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 20, color: '#111827',
                }}>
                  {tx.givingStreak}
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginLeft: 3 }}>mo</span>
                </div>
              </div>
              <div style={{
                background: '#F4F5F7', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>
                  Total Given
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 20, color: '#111827',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatAmount(tx.totalGiven)}
                </div>
              </div>
            </div>

            {/* Streak dots */}
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#6B7280', marginBottom: 8 }}>
                Consecutive months
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: i < tx.givingStreak ? '#4F6BED' : '#E5E7EB',
                      opacity: i < tx.givingStreak ? (0.4 + (i / tx.givingStreak) * 0.6) : 1,
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate(`/members/${tx.memberNumber.toLowerCase()}`)}
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
        </div>
      </div>
    </>
  )
}

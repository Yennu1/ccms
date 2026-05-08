import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'tithe' | 'offering' | 'building' | 'welfare' | 'thanksgiving' | 'special'
type Method = 'cash' | 'momo' | 'bank' | 'cheque'
type MoMoNetwork = 'mtn' | 'vodafone' | 'airteltigo'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; dot: string; bg: string; color: string }[] = [
  { key: 'tithe',        label: 'Tithe',            dot: '#C8964A', bg: '#FEF6E5', color: '#8A6418' },
  { key: 'offering',     label: 'Offering',          dot: '#22C55E', bg: '#DCFCE7', color: '#166534' },
  { key: 'building',     label: 'Building Fund',     dot: '#7B93F5', bg: '#E8ECF9', color: '#3349C7' },
  { key: 'welfare',      label: 'Welfare',           dot: '#8B5CF6', bg: '#EDE9FE', color: '#5B21B6' },
  { key: 'thanksgiving', label: 'Thanksgiving',      dot: '#EF4444', bg: '#FFE4E6', color: '#9F1239' },
  { key: 'special',      label: 'Special Offering',  dot: '#EC4899', bg: '#FCE7F3', color: '#9D174D' },
]

const METHODS: { key: Method; label: string }[] = [
  { key: 'cash',   label: 'Cash' },
  { key: 'momo',   label: 'Mobile Money' },
  { key: 'bank',   label: 'Bank Transfer' },
  { key: 'cheque', label: 'Cheque' },
]

const MOMO_NETWORKS: { key: MoMoNetwork; label: string; color: string }[] = [
  { key: 'mtn',       label: 'MTN',       color: '#F59E0B' },
  { key: 'vodafone',  label: 'Vodafone',  color: '#EF4444' },
  { key: 'airteltigo',label: 'AirtelTigo',color: '#3B82F6' },
]

const SAMPLE_MEMBERS = [
  { id: '1', firstName: 'Kwame',    lastName: 'Asante',   memberNumber: 'GH-00001' },
  { id: '2', firstName: 'Abena',    lastName: 'Mensah',   memberNumber: 'GH-00002' },
  { id: '3', firstName: 'Kofi',     lastName: 'Boateng',  memberNumber: 'GH-00003' },
  { id: '4', firstName: 'Ama',      lastName: 'Owusu',    memberNumber: 'GH-00004' },
  { id: '5', firstName: 'Emmanuel', lastName: 'Darko',    memberNumber: 'GH-00005' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function RecordGivingPage() {
  const navigate = useNavigate()

  const [isAnonymous, setIsAnonymous]           = useState(false)
  const [memberSearch, setMemberSearch]         = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category>('tithe')
  const [amount, setAmount]                     = useState('')
  const [selectedMethod, setSelectedMethod]     = useState<Method>('cash')
  const [momoNetwork, setMomoNetwork]           = useState<MoMoNetwork>('mtn')
  const [momoNumber, setMomoNumber]             = useState('')
  const [linkedEvent, setLinkedEvent]           = useState('Sunday Service — May 4, 2026')
  const [transactionDate, setTransactionDate]   = useState('2026-05-04')
  const [referenceNumber, setReferenceNumber]   = useState('')
  const [notes, setNotes]                       = useState('')

  const selectedMember = SAMPLE_MEMBERS.find(m => m.id === selectedMemberId) ?? null
  const filteredMembers = SAMPLE_MEMBERS.filter(m => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
    return `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q)
  })
  const activeCat = CATEGORIES.find(c => c.key === selectedCategory)!
  const activeMethod = METHODS.find(m => m.key === selectedMethod)!

  // ─── Style shorthands ──────────────────────────────────────────────────────

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

  return (
    <>
      <style>{`
        .rg-input:focus { border-color: #4F6BED !important; }
        .rg-select:focus { border-color: #4F6BED !important; outline: none; }
        .cat-pill:hover { opacity: 0.8; }
        .method-pill:hover { opacity: 0.85; }
        .network-pill:hover { opacity: 0.85; }
        .member-result:hover { background: #F4F5F7 !important; }
        .rg-action-btn:hover { background: #F4F5F7 !important; }
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
        <div>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700, fontSize: 20, color: '#111827',
            letterSpacing: '-0.015em', margin: 0,
          }}>
            Record Giving
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: '#6B7280', margin: '2px 0 0',
          }}>
            Log a cash, MoMo, or bank contribution
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Form sections ── */}
        <div>

          {/* Section 1: Contributor */}
          <div style={card}>
            <div style={sectionLabel}>Contributor</div>

            {/* Anonymous toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <span style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: '#374151',
              }}>
                Anonymous giving
              </span>
              <button
                onClick={() => { setIsAnonymous(v => !v); setSelectedMemberId(null); setMemberSearch('') }}
                style={{
                  width: 40, height: 22, borderRadius: 999, flexShrink: 0,
                  background: isAnonymous ? '#4F6BED' : '#E5E7EB',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.15s',
                }}
                aria-label="Toggle anonymous"
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: isAnonymous ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                }} />
              </button>
            </div>

            {/* Member selector */}
            {isAnonymous ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: '#F4F5F7', borderRadius: 8,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5.5" r="2.5" stroke="#9CA3AF" strokeWidth="1.4" />
                    <path d="M2.5 13c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#374151' }}>
                    Anonymous Giver
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>
                    No member record linked
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label style={fieldLabel}>Member</label>
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
                      {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                    </div>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      fontWeight: 600, fontSize: 13, color: '#1B2352', flex: 1,
                    }}>
                      {selectedMember.firstName} {selectedMember.lastName}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280' }}>
                      {selectedMember.memberNumber}
                    </span>
                    <button
                      onClick={() => setSelectedMemberId(null)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9CA3AF', padding: 2, display: 'grid', placeItems: 'center',
                      }}
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
                      placeholder="Search member by name or ID..."
                      value={memberSearch}
                      onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true) }}
                      onFocus={() => setMemberDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                      style={inputBase}
                    />
                    {memberDropdownOpen && filteredMembers.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, overflow: 'hidden',
                      }}>
                        {filteredMembers.map(m => (
                          <div
                            key={m.id}
                            className="member-result"
                            onMouseDown={() => { setSelectedMemberId(m.id); setMemberSearch(''); setMemberDropdownOpen(false) }}
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
                              {m.firstName[0]}{m.lastName[0]}
                            </div>
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#111827' }}>
                                {m.firstName} {m.lastName}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                                {m.memberNumber}
                              </div>
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

          {/* Section 2: Giving Details */}
          <div style={card}>
            <div style={sectionLabel}>Giving Details</div>

            <label style={fieldLabel}>Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  className="cat-pill"
                  onClick={() => setSelectedCategory(c.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    border: selectedCategory === c.key ? `1.5px solid ${c.dot}` : '1.5px solid transparent',
                    background: selectedCategory === c.key ? c.bg : '#F4F5F7',
                    color: selectedCategory === c.key ? c.color : '#6B7280',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 12.5, transition: 'all 0.12s',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: selectedCategory === c.key ? c.dot : '#D1D5DB',
                  }} />
                  {c.label}
                </button>
              ))}
            </div>

            <label style={fieldLabel}>Amount</label>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 18, fontWeight: 500, color: '#9CA3AF', pointerEvents: 'none',
              }}>₵</span>
              <input
                className="rg-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{
                  ...inputBase, height: 50, paddingLeft: 30,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 22, fontWeight: 600, color: '#111827',
                  letterSpacing: '-0.01em',
                }}
              />
            </div>

            <label style={fieldLabel}>Payment Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: selectedMethod === 'momo' ? 0 : 0 }}>
              {METHODS.map(m => (
                <button
                  key={m.key}
                  className="method-pill"
                  onClick={() => setSelectedMethod(m.key)}
                  style={{
                    height: 38, borderRadius: 8, cursor: 'pointer',
                    border: selectedMethod === m.key ? '1.5px solid #4F6BED' : '1.5px solid #E5E7EB',
                    background: selectedMethod === m.key ? '#EEF1FE' : '#fff',
                    color: selectedMethod === m.key ? '#4F6BED' : '#6B7280',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 12.5, transition: 'all 0.12s',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {selectedMethod === 'momo' && (
              <div style={{
                background: '#FAFBFE', border: '0.5px solid #E8ECF9',
                borderRadius: 10, padding: 14, marginTop: 14,
              }}>
                <label style={{ ...fieldLabel, marginBottom: 10 }}>Network</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {MOMO_NETWORKS.map(n => (
                    <button
                      key={n.key}
                      className="network-pill"
                      onClick={() => setMomoNetwork(n.key)}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                        border: momoNetwork === n.key ? `1.5px solid ${n.color}` : '1.5px solid #E5E7EB',
                        background: momoNetwork === n.key ? `${n.color}18` : '#fff',
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
          </div>

          {/* Section 3: Event & Date */}
          <div style={card}>
            <div style={sectionLabel}>Event & Date</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Linked Event</label>
                <select
                  className="rg-select"
                  value={linkedEvent}
                  onChange={e => setLinkedEvent(e.target.value)}
                  style={{ ...inputBase, padding: '0 12px', cursor: 'pointer' } as React.CSSProperties}
                >
                  <option>Sunday Service — May 4, 2026</option>
                  <option>Midweek Service — May 7, 2026</option>
                  <option>Youth Service — May 3, 2026</option>
                  <option>Special Programme</option>
                  <option>No specific event</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Transaction Date</label>
                <input
                  className="rg-input"
                  type="date"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
              <div>
                <label style={fieldLabel}>Reference Number (optional)</label>
                <input
                  className="rg-input"
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  style={{ ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div style={card}>
            <div style={sectionLabel}>Notes</div>
            <textarea
              className="rg-input"
              placeholder="Any additional notes about this contribution..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              style={{
                ...inputBase, height: 'auto', padding: '10px 12px',
                resize: 'vertical', lineHeight: 1.6,
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* ── Right: Live preview card ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{
            background: '#FAFBFE', border: '0.5px solid #E8ECF9',
            borderRadius: 12, padding: 20,
          }}>
            <div style={sectionLabel}>Preview</div>

            {/* Receipt card */}
            <div style={{
              background: '#fff', border: '0.5px solid #E5E7EB',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* Receipt header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px dashed #E5E7EB' }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 10,
                }}>
                  Contribution Receipt
                </div>
                <div style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700, fontSize: 30, color: '#111827',
                  letterSpacing: '-0.02em', lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {amount
                    ? `₵${parseFloat(amount || '0').toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
                    : '₵0.00'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: activeCat.bg, color: activeCat.color,
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 600, fontSize: 11.5,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: activeCat.dot }} />
                    {activeCat.label}
                  </span>
                </div>
              </div>

              {/* Receipt details */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Member</span>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {isAnonymous ? 'Anonymous' : selectedMember
                      ? `${selectedMember.firstName} ${selectedMember.lastName}`
                      : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF' }}>Method</span>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {activeMethod.label}
                    {selectedMethod === 'momo' && momoNetwork
                      ? ` · ${MOMO_NETWORKS.find(n => n.key === momoNetwork)!.label}`
                      : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>Event</span>
                  <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#374151', fontWeight: 500, textAlign: 'right' }}>
                    {linkedEvent || '—'}
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

            <p style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: 11.5, color: '#9CA3AF', textAlign: 'center',
              lineHeight: 1.5, marginTop: 12,
            }}>
              A receipt is available to print after saving.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 220, right: 0,
        background: '#fff', borderTop: '0.5px solid #E5E7EB',
        padding: '12px 32px',
        display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 100,
      }}>
        <span style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 12, color: '#9CA3AF', flex: 1,
        }}>
          Auto-saved as draft
        </span>
        <button
          className="rg-action-btn"
          onClick={() => navigate('/donations')}
          style={{
            height: 36, padding: '0 16px', borderRadius: 8,
            border: '0.5px solid #E5E7EB', background: '#fff',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer',
            transition: 'background 0.12s',
          }}
        >
          Discard
        </button>
        <button
          className="rg-action-btn"
          style={{
            height: 36, padding: '0 16px', borderRadius: 8,
            border: '0.5px solid #E5E7EB', background: '#fff',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 13, color: '#374151', cursor: 'pointer',
            transition: 'background 0.12s',
          }}
        >
          Save &amp; Print Receipt
        </button>
        <button
          style={{
            height: 36, padding: '0 20px', borderRadius: 8,
            border: 'none', background: '#4F6BED',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 13, color: '#fff', cursor: 'pointer',
          }}
        >
          Save Giving
        </button>
      </div>

      {/* Spacer for sticky bar */}
      <div style={{ height: 64 }} />
    </>
  )
}

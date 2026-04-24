import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const STAT_CARDS = [
  { label: 'TOTAL MEMBERS',    value: '—', accent: '#4F6BED' },
  { label: 'MONTHLY GIVING (GHS)', value: '—', accent: '#22C55E' },
  { label: 'ACTIVE GROUPS',   value: '—', accent: '#C8964A' },
  { label: 'ATTENDANCE',      value: '—', accent: '#7B93F5' },
]

export function DashboardPage() {
  const { user } = useAuthStore()

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 20,
          color: '#111827',
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          Dashboard
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13,
          color: '#6B7280',
          marginTop: 4,
          marginBottom: 0,
        }}>
          Welcome back, {user?.full_name ?? 'there'}.
        </p>
      </div>

      {/* Stat cards 2x2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        {STAT_CARDS.map(card => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: 12,
            border: '0.5px solid #E5E7EB',
            padding: 24,
            borderBottom: `3px solid ${card.accent}`,
          }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 11,
              color: '#9CA3AF',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 32,
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Members */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '0.5px solid #E5E7EB',
        overflow: 'hidden',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '0.5px solid #E5E7EB',
        }}>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}>
            Recent Members
          </span>
          <Link to="/members" style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13,
            color: '#4F6BED',
            textDecoration: 'none',
          }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            View all →
          </Link>
        </div>

        {/* Empty state */}
        <div style={{
          padding: 32,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13,
            color: '#9CA3AF',
            margin: 0,
          }}>
            No members yet. Add your first member to get started.
          </p>
        </div>
      </div>
    </div>
  )
}

interface Props {
  secondsLeft: number
  onStayLoggedIn: () => void
  onLogoutNow: () => void
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function LockIcon() {
  return (
    <svg
      width="32" height="32" viewBox="0 0 24 24" fill="none"
      stroke="#4F6BED" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function SessionTimeoutWarning({ secondsLeft, onStayLoggedIn, onLogoutNow }: Props) {
  return (
    <>
      <style>{`
        @keyframes st-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .st-primary-btn:hover { background: #3D59D8 !important; }
        .st-ghost-btn:hover   { background: var(--dm-bg-muted) !important; }
      `}</style>

      {/* Backdrop — blurs entire app behind the modal */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Modal card */}
        <div
          style={{
            background: 'var(--dm-bg-card)',
            border: '0.5px solid var(--dm-border-soft)',
            borderRadius: 12,
            padding: 32,
            maxWidth: 400,
            width: '90%',
            textAlign: 'center',
            animation: 'st-fade-in 0.2s ease forwards',
          }}
        >
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(79,107,237,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LockIcon />
            </div>
          </div>

          {/* Heading */}
          <div style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600, fontSize: 18,
            color: 'var(--dm-text-ink)',
            letterSpacing: '-0.015em',
            marginBottom: 6,
          }}>
            Session Expiring
          </div>

          {/* Subtext */}
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 13, color: 'var(--dm-text-secondary)',
            lineHeight: 1.5, marginBottom: 4,
          }}>
            Due to inactivity, you'll be logged out in
          </div>

          {/* Countdown */}
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500, fontSize: 40,
            color: 'var(--dm-text-ink)',
            letterSpacing: '-0.02em',
            margin: '12px 0 20px',
          }}>
            {formatTime(secondsLeft)}
          </div>

          {/* Stay Logged In */}
          <button
            className="st-primary-btn"
            onClick={onStayLoggedIn}
            style={{
              width: '100%', height: 40,
              background: '#4F6BED', color: '#fff',
              border: 'none', borderRadius: 8,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s',
              marginBottom: 8,
            }}
          >
            Stay Logged In
          </button>

          {/* Log Out Now */}
          <button
            className="st-ghost-btn"
            onClick={onLogoutNow}
            style={{
              width: '100%', height: 40,
              background: 'transparent',
              color: 'var(--dm-text-secondary)',
              border: '0.5px solid var(--dm-border)',
              borderRadius: 8,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500, fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Log Out Now
          </button>
        </div>
      </div>
    </>
  )
}

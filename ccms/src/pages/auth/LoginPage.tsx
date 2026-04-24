import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ animation: 'ccms-spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18.06 18.06 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { loginError, setLoginError } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)
    setLoginError(null)
    try {
      // Clear any stale session before attempting login
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) localStorage.removeItem(key)
      })
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        /* ── Keyframes ───────────────────────────────────── */
        @keyframes ccms-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes ccms-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        @keyframes ccms-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes ccms-hex-drift {
          0%   { transform: translateY(0px)   rotate(0deg);  }
          50%  { transform: translateY(-6px)  rotate(1deg);  }
          100% { transform: translateY(0px)   rotate(0deg);  }
        }

        /* ── Root ────────────────────────────────────────── */
        .ccms-root {
          position: fixed;
          inset: 0;
          display: flex;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }

        /* ── Entrance animation helper ───────────────────── */
        .ccms-reveal {
          opacity: 0;
          animation: ccms-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* ── Left panel ──────────────────────────────────── */
        .ccms-left {
          width: 50%;
          height: 100vh;
          background:
            radial-gradient(ellipse 80% 60% at 92% 8%,  #2D3A6B 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 5%  92%, #141C42 0%, transparent 60%),
            #1B2352;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 32px 44px;
          box-sizing: border-box;
          animation: ccms-fade-in 0.5s ease forwards;
        }

        /* Grain texture overlay — gives the left panel tactile depth */
        .ccms-left::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.055'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 180px 180px;
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Right panel ─────────────────────────────────── */
        .ccms-right {
          width: 50%;
          height: 100vh;
          background-color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          overflow-y: auto;
          box-sizing: border-box;
        }

        /* ── Dark mode ───────────────────────────────────── */
        @media (prefers-color-scheme: dark) {
          .ccms-right           { background-color: #13161F; }
          .ccms-form-card       {
            background: #1A1D27;
            border: 0.5px solid rgba(255,255,255,0.07);
            border-radius: 16px;
            padding: 40px;
          }
          .ccms-form-heading    { color: #F0F1F5 !important; }
          .ccms-form-sub        { color: rgba(240,241,245,0.42) !important; }
          .ccms-field-label     { color: rgba(240,241,245,0.6) !important; }
          .ccms-input           {
            background: #1A1E2E !important;
            border-color: rgba(255,255,255,0.08) !important;
            color: #F0F1F5 !important;
          }
          .ccms-input::placeholder { color: rgba(240,241,245,0.26) !important; }
          .ccms-input:hover:not(:focus) { border-color: rgba(255,255,255,0.14) !important; }
          .ccms-error-banner    {
            background: rgba(239,68,68,0.09) !important;
            border-color: rgba(239,68,68,0.22) !important;
            color: #FCA5A5 !important;
          }
          .ccms-divider-line    { background: rgba(255,255,255,0.07) !important; }
          .ccms-footer-muted    { color: rgba(240,241,245,0.32) !important; }
        }

        /* ── Inputs ──────────────────────────────────────── */
        .ccms-input {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border: 0.5px solid #D1D5DB;
          border-radius: 8px;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 13px;
          color: #111827;
          background: #FFFFFF;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .ccms-input:hover:not(:focus) {
          border-color: #B0B9CC;
          background: #FAFBFF;
        }

        .ccms-input:focus {
          border-color: #4F6BED;
          box-shadow: 0 0 0 3px rgba(79,107,237,0.13);
        }

        .ccms-input.ccms-input--error              { border-color: #EF4444; }
        .ccms-input.ccms-input--error:focus        { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
        .ccms-input::placeholder                   { color: #9CA3AF; }
        .ccms-input--pw                            { padding-right: 40px; }

        /* ── Password toggle ─────────────────────────────── */
        .ccms-pw-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #9CA3AF;
          display: flex;
          align-items: center;
          line-height: 1;
          transition: color 0.15s, transform 0.15s;
        }
        .ccms-pw-toggle:hover {
          color: #4F6BED;
          transform: translateY(-50%) scale(1.1);
        }

        /* ── Sign-in button ──────────────────────────────── */
        .ccms-btn {
          width: 100%;
          height: 38px;
          background: #4F6BED;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: -0.01em;
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
        }

        .ccms-btn:hover:not(:disabled) {
          background: #3D59D8;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(79,107,237,0.32);
        }

        .ccms-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }

        .ccms-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ── Links ───────────────────────────────────────── */
        .ccms-link {
          color: #4F6BED;
          text-decoration: none;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: color 0.12s;
        }
        .ccms-link:hover { color: #3D59D8; text-decoration: underline; }

        /* ── Floating hex animation ───────────────────────── */
        .ccms-hex-float {
          animation: ccms-hex-drift 8s ease-in-out infinite;
          transform-origin: center;
        }
        .ccms-hex-float-slow {
          animation: ccms-hex-drift 11s ease-in-out infinite reverse;
          transform-origin: center;
        }

        /* ── Mobile ──────────────────────────────────────── */
        @media (max-width: 768px) {
          .ccms-root {
            position: static;
            flex-direction: column;
            min-height: 100vh;
          }
          .ccms-left {
            width: 100%;
            min-height: 210px;
            padding: 28px 24px;
          }
          .ccms-right {
            width: 100%;
            flex: 1;
          }
        }
      `}</style>

      <div className="ccms-root">

        {/* ══ LEFT PANEL ══════════════════════════════════════════ */}
        <div className="ccms-left">

          {/* ── Background geometry SVG ── */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 0,
            }}
            viewBox="0 0 560 900"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Subtle grid */}
              <pattern id="ccms-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#7B93F5" strokeWidth="0.5" strokeOpacity="0.04" />
              </pattern>
              {/* Radial gradient for circle softness */}
              <radialGradient id="ccms-glow-a" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#4F6BED" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#4F6BED" stopOpacity="0"    />
              </radialGradient>
              <radialGradient id="ccms-glow-b" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#3D59D8" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#3D59D8" stopOpacity="0"    />
              </radialGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#ccms-grid)" />

            {/* Background glow circles — capped at r=200, opacity 0.06 */}
            <circle cx="500" cy="100" r="200" fill="#4F6BED" fillOpacity="0.06" />
            <circle cx="55"  cy="820" r="180" fill="#4F6BED" fillOpacity="0.06" />
            {/* Mid-panel accent — keeps geometry spread across full height */}
            <circle cx="430" cy="460" r="120" fill="#4F6BED" fillOpacity="0.03" />

            {/* Hexagon — top right (floats slowly) */}
            <g className="ccms-hex-float">
              <polygon
                points="448,42 512,78.9 512,152.9 448,189.8 384,152.9 384,78.9"
                fill="none" stroke="#C8964A" strokeWidth="0.75" strokeOpacity="0.22"
              />
              <polygon
                points="448,66 494,92.5 494,145.5 448,172 402,145.5 402,92.5"
                fill="none" stroke="#C8964A" strokeWidth="0.4" strokeOpacity="0.1"
              />
              <circle cx="448" cy="116" r="5"  fill="#C8964A" fillOpacity="0.7"  />
              <circle cx="448" cy="116" r="11" fill="#C8964A" fillOpacity="0.07" />
            </g>

            {/* Hexagon — mid right (small, anchors the centre) */}
            <g className="ccms-hex-float-slow">
              <polygon
                points="490,390 524,409.6 524,448.8 490,468.4 456,448.8 456,409.6"
                fill="none" stroke="#C8964A" strokeWidth="0.5" strokeOpacity="0.14"
              />
              <circle cx="490" cy="429" r="3" fill="#C8964A" fillOpacity="0.35" />
            </g>

            {/* Hexagon — bottom left (drifts opposite phase) */}
            <g className="ccms-hex-float">
              <polygon
                points="92,690 168,734 168,822 92,866 16,822 16,734"
                fill="none" stroke="#C8964A" strokeWidth="0.75" strokeOpacity="0.22"
              />
              <polygon
                points="92,714 142,742 142,798 92,826 42,798 42,742"
                fill="none" stroke="#C8964A" strokeWidth="0.4" strokeOpacity="0.09"
              />
              <circle cx="92" cy="778" r="5"  fill="#C8964A" fillOpacity="0.7"  />
              <circle cx="92" cy="778" r="11" fill="#C8964A" fillOpacity="0.06" />
            </g>

            {/* Diagonal accent lines — subtle asymmetry */}
            <line
              x1="0" y1="620" x2="200" y2="900"
              stroke="#4F6BED" strokeWidth="0.5" strokeOpacity="0.06"
            />
            <line
              x1="560" y1="280" x2="360" y2="0"
              stroke="#4F6BED" strokeWidth="0.5" strokeOpacity="0.05"
            />
          </svg>

          {/* ── Zone 1: Logo — anchored top ── */}
          <div
            className="ccms-reveal"
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 10,
              alignSelf: 'flex-start',
              animationDelay: '0ms',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <polygon
                points="15,1.5 27,8.25 27,21.75 15,28.5 3,21.75 3,8.25"
                fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.92"
              />
              <circle cx="15" cy="15" r="2.8" fill="white" fillOpacity="0.92" />
            </svg>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              fontSize: '15px',
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              Centry CMS
            </span>
          </div>

          {/* ── Zone 2: Hero copy — flex:1 centers it in remaining space ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}>
            <h1
              className="ccms-reveal"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: '28px',
                color: '#fff',
                letterSpacing: '-0.02em',
                lineHeight: 1.28,
                margin: '0 0 14px 0',
                maxWidth: 340,
                animationDelay: '110ms',
              }}
            >
              Manage your church,{' '}
              <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                not your spreadsheets.
              </em>
            </h1>
            <p
              className="ccms-reveal"
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: '13px',
                color: 'rgba(255,255,255,0.48)',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 320,
                animationDelay: '220ms',
              }}
            >
              Members, giving, attendance and insights — all in one place built for Ghanaian churches.
            </p>
          </div>

          {/* ── Zone 3: Social proof — pinned to bottom ── */}
          <p
            className="ccms-reveal"
            style={{
              position: 'relative', zIndex: 1,
              alignSelf: 'flex-start',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontSize: '12px',
              color: 'rgba(255,255,255,0.28)',
              margin: 0,
              letterSpacing: '0.01em',
              animationDelay: '340ms',
            }}
          >
            Trusted by churches across Ghana
          </p>
        </div>

        {/* ══ RIGHT PANEL ═════════════════════════════════════════ */}
        <div className="ccms-right">
          <div className="ccms-form-card" style={{ width: '100%', maxWidth: 340 }}>

            {/* Heading */}
            <h2
              className="ccms-form-heading ccms-reveal"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: '22px',
                color: '#111827',
                letterSpacing: '-0.02em',
                margin: '0 0 4px 0',
                animationDelay: '160ms',
              }}
            >
              Welcome back
            </h2>
            <p
              className="ccms-form-sub ccms-reveal"
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: '13px',
                color: '#6B7280',
                margin: '0 0 28px 0',
                animationDelay: '230ms',
              }}
            >
              Sign in to your organisation
            </p>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div
                className="ccms-reveal"
                style={{ display: 'flex', flexDirection: 'column', gap: 5, animationDelay: '310ms' }}
              >
                <label
                  htmlFor="email"
                  className="ccms-field-label"
                  style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: '12px', fontWeight: 500, color: '#374151' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@church.org"
                  className={`ccms-input${errors.email ? ' ccms-input--error' : ''}`}
                  {...register('email')}
                />
                {errors.email && (
                  <p style={{ fontSize: '12px', color: '#EF4444', margin: 0, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div
                className="ccms-reveal"
                style={{ display: 'flex', flexDirection: 'column', gap: 5, animationDelay: '390ms' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label
                    htmlFor="password"
                    className="ccms-field-label"
                    style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: '12px', fontWeight: 500, color: '#374151' }}
                  >
                    Password
                  </label>
                  <a href="#" className="ccms-link" style={{ fontSize: '12px' }}>
                    Forgot password?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`ccms-input ccms-input--pw${errors.password ? ' ccms-input--error' : ''}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="ccms-pw-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <p style={{ fontSize: '12px', color: '#EF4444', margin: 0, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Profile-missing error (set by onAuthStateChange) */}
              {loginError && (
                <div
                  className="ccms-error-banner"
                  style={{
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '0.5px solid #FECACA',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#DC2626',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  }}
                >
                  {loginError}
                </div>
              )}

              {/* Auth error */}
              {error && (
                <div
                  className="ccms-error-banner ccms-reveal"
                  style={{
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '0.5px solid #FECACA',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#DC2626',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    animationDelay: '0ms',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="ccms-reveal" style={{ animationDelay: '470ms' }}>
                <button type="submit" className="ccms-btn" disabled={isLoading}>
                  {isLoading ? <><Spinner /> Signing in…</> : 'Sign in'}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div
              className="ccms-reveal"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '20px 0',
                animationDelay: '540ms',
              }}
            >
              <div className="ccms-divider-line" style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
              <span className="ccms-footer-muted" style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
                or
              </span>
              <div className="ccms-divider-line" style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
            </div>

            {/* Footer */}
            <p
              className="ccms-footer-muted ccms-reveal"
              style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#9CA3AF',
                margin: 0,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                animationDelay: '600ms',
              }}
            >
              Don't have an account?{' '}
              <a href="mailto:admin@church.org" className="ccms-link">
                Contact your admin
              </a>
            </p>
          </div>
        </div>

      </div>
    </>
  )
}

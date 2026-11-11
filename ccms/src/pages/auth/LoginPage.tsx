import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_HOME_ROUTE } from '../../lib/constants'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ animation: 'ccms-spin 0.7s linear infinite', flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18.06 18.06 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && user) {
      navigate(ROLE_HOME_ROUTE[user.role] ?? '/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirm, setSignUpConfirm] = useState('')
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [signUpError, setSignUpError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1B2352', borderTopColor: '#4F6BED', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)
    try {
      Object.keys(localStorage).forEach(key => { if (key.startsWith('sb-')) localStorage.removeItem(key) })
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
      if (error) { setError(error.message) } else { navigate('/') }
    } catch { setError('Something went wrong. Please try again.') }
    finally { setIsLoading(false) }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) return
    setResetSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: 'https://ccms-inky.vercel.app/accept-invite',
    })
    setResetSending(false)
    if (error) { toast.error(error.message); return }
    setResetSent(true)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignUpError(null)
    if (!signUpEmail.trim()) { setSignUpError('Email is required'); return }
    if (signUpPassword.length < 6) { setSignUpError('Password must be at least 6 characters'); return }
    if (signUpPassword !== signUpConfirm) { setSignUpError('Passwords do not match'); return }
    setSignUpLoading(true)
    const { error } = await supabase.auth.signUp({
      email: signUpEmail.trim(), password: signUpPassword,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    setSignUpLoading(false)
    if (error) { setSignUpError(error.message) } else { setSignUpSuccess(true) }
  }

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) toast.error(error.message)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Boldonse&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        @keyframes ccms-spin { to { transform: rotate(360deg); } }
        @keyframes ccms-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ccms-reveal { opacity: 0; animation: ccms-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }

        .login-root {
          position: fixed; inset: 0;
          display: flex; align-items: stretch;
          background: #fff;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }

        .login-hero {
          flex: 1.05;
          background: linear-gradient(160deg, #0a1030 0%, #121a4a 22%, #1e2e78 44%, #2d47b0 64%, #3f5fd4 82%, #4F6BED 100%);
          border-radius: 16px;
          margin: 8px;
          display: flex;
          flex-direction: column;
          padding: 32px 36px;
          position: relative;
          overflow: hidden;
        }
        .login-hero::before {
          content: ''; position: absolute; top: -20%; right: -10%;
          width: 70%; height: 70%;
          background: radial-gradient(circle, rgba(120,160,255,0.25) 0%, transparent 70%);
          pointer-events: none;
        }
        .login-hero::after {
          content: ''; position: absolute; bottom: 10%; left: 20%;
          width: 50%; height: 40%;
          background: radial-gradient(circle, rgba(79,107,237,0.2) 0%, transparent 70%);
          pointer-events: none;
        }

        .hero-logo {
          display: flex; align-items: center; gap: 10px;
          position: relative; z-index: 1;
        }
        .hero-logo-box {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
        }
        .hero-logo-box svg { width: 20px; height: 20px; }
        .hero-logo-name {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 600; font-size: 18px; color: #fff;
        }

        .hero-center {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; position: relative; z-index: 1;
        }
        .hero-center h1 {
          font-family: 'Boldonse', 'Plus Jakarta Sans', sans-serif;
          font-weight: 400; font-size: 28px; color: #fff;
          line-height: 1.4; margin: 0; letter-spacing: -0.01em;
        }
        .hero-center p {
          font-size: 15px; color: rgba(255,255,255,0.5);
          margin: 14px 0 0; line-height: 1.5;
        }

        .login-form-side {
          flex: 0.95;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 48px;
          overflow-y: auto;
        }
        .login-form-wrap { width: 100%; max-width: 420px; }

        .form-heading {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 28px; color: #111;
          margin: 0 0 6px; text-align: center;
          letter-spacing: -0.02em;
        }
        .form-sub {
          font-size: 15px; color: #888;
          margin: 0 0 32px; text-align: center;
        }

        .field-group { margin-bottom: 18px; }
        .field-label {
          display: block; font-size: 14px; font-weight: 500;
          color: #333; margin-bottom: 7px;
        }
        .field-input {
          width: 100%; height: 48px; border-radius: 10px;
          border: 1.5px solid #e0e0e0; background: #fafafa;
          padding: 0 16px; font-size: 15px; color: #111;
          box-sizing: border-box; outline: none;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input::placeholder { color: #bbb; }
        .field-input:focus { border-color: #4F6BED; box-shadow: 0 0 0 3px rgba(79,107,237,0.1); }
        .field-input.has-error { border-color: #EF4444; }
        .field-input.has-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
        .field-input--pw { padding-right: 48px; }

        .pw-toggle {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 0;
          color: #bbb; display: flex; align-items: center; transition: color 0.15s;
        }
        .pw-toggle:hover { color: #4F6BED; }

        .continue-btn {
          width: 100%; height: 50px; border-radius: 10px; border: none;
          background: #4F6BED; color: #fff; font-size: 16px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 8px; margin-top: 6px;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: background 0.15s;
        }
        .continue-btn:hover:not(:disabled) { background: #3D59D8; }
        .continue-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .signup-link {
          text-align: center; margin-top: 20px;
          font-size: 14px; color: #888;
        }
        .signup-link a { color: #4F6BED; font-weight: 500; text-decoration: none; cursor: pointer; }
        .signup-link a:hover { text-decoration: underline; }

        .divider-row { display: flex; align-items: center; gap: 14px; margin: 22px 0; }
        .divider-line { flex: 1; height: 1px; background: #eee; }
        .divider-text { font-size: 13px; color: #bbb; }

        .google-btn {
          width: 100%; height: 50px; border-radius: 10px;
          border: 1.5px solid #e0e0e0; background: #fff;
          display: flex; align-items: center; justify-content: center;
          gap: 10px; cursor: pointer; font-size: 15px; font-weight: 500;
          color: #111; font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: background 0.12s, border-color 0.12s;
        }
        .google-btn:hover { background: #f8f8f8; border-color: #ccc; }

        .terms-text {
          text-align: center; margin-top: 20px;
          font-size: 12px; color: #aaa; line-height: 1.6;
        }
        .terms-text a { color: #888; text-decoration: underline; }

        .error-banner {
          border-radius: 10px; background: #FEF2F2;
          border: 1px solid #FECACA; padding: 12px 14px;
          font-size: 14px; color: #991B1B; margin-bottom: 6px;
        }

        .forgot-link { font-size: 13px; color: #4F6BED; text-decoration: none; cursor: pointer; }
        .forgot-link:hover { text-decoration: underline; }

        .back-link {
          display: block; text-align: center; margin-top: 20px;
          font-size: 14px; color: #4F6BED; text-decoration: none; cursor: pointer;
        }
        .back-link:hover { text-decoration: underline; }

        @media (max-width: 900px) {
          .login-root { flex-direction: column; }
          .login-hero {
            flex: none; min-height: 220px; margin: 0;
            border-radius: 0 0 20px 20px; padding: 28px 24px;
          }
          .hero-center h1 { font-size: 28px; }
          .login-form-side { flex: 1; padding: 28px 24px; }
          .login-form-wrap { max-width: 100%; }
        }
        @media (max-width: 480px) {
          .login-hero { min-height: 190px; padding: 24px 20px; }
          .hero-center h1 { font-size: 24px; }
          .form-heading { font-size: 24px; }
          .form-sub { font-size: 14px; }
        }
      `}</style>

      <div className="login-root">
        <div className="login-hero">
          <div className="hero-logo">
            <div className="hero-logo-box">
              <svg viewBox="204 269 997 1065" fill="none">
                <g transform="translate(0.000000,1600.000000) scale(0.100000,-0.100000)" fill="#FFFFFF" stroke="none">
                  <path d="M7110 12913 c-19 -2 -102 -10 -185 -19 -82 -8 -166 -17 -185 -19 -97 -9 -443 -74 -535 -100 -64 -18 -160 -44 -205 -55 -159 -41 -280 -83 -290 -101 -7 -12 6 -892 16 -1089 15 -320 20 -468 16 -482 -4 -17 -20 -23 -52 -18 -16 1 -43 15 -185 90 -49 26 -160 84 -245 128 -272 140 -375 196 -378 204 -2 4 -12 8 -21 8 -10 0 -29 8 -42 18 -13 10 -40 25 -59 32 -19 8 -55 26 -80 40 -25 15 -70 39 -100 54 -30 15 -77 40 -105 56 -27 16 -92 50 -144 76 -106 52 -106 52 -186 -18 -24 -21 -48 -38 -54 -38 -6 0 -11 -4 -11 -10 0 -5 -18 -27 -41 -47 -67 -62 -279 -275 -279 -280 0 -3 -11 -14 -25 -25 -25 -19 -123 -129 -195 -217 -19 -24 -43 -52 -52 -64 -10 -11 -18 -23 -18 -26 0 -3 -10 -17 -23 -31 -13 -14 -38 -47 -57 -75 -18 -27 -46 -66 -60 -85 -89 -118 -108 -147 -110 -165 -4 -36 0 -44 23 -51 12 -3 33 -15 47 -25 14 -9 59 -35 100 -57 41 -21 118 -62 170 -90 52 -28 147 -78 210 -110 63 -33 131 -69 150 -81 19 -12 53 -30 75 -42 96 -49 250 -130 303 -160 31 -18 75 -42 97 -54 22 -11 50 -26 63 -33 12 -7 32 -17 45 -24 39 -21 221 -120 267 -146 212 -118 382 -201 470 -227 47 -14 105 -32 130 -41 25 -8 64 -14 86 -14 23 0 66 -5 95 -10 129 -25 422 -6 562 35 139 41 166 51 217 73 30 13 73 33 95 45 22 11 49 25 60 30 11 6 27 14 35 18 8 5 31 17 50 28 19 11 44 28 55 38 11 10 36 30 55 43 81 57 280 252 280 275 0 3 12 18 26 34 33 37 134 207 134 226 0 8 5 17 10 20 6 3 10 15 10 26 0 10 3 19 8 19 18 0 92 214 92 266 0 17 9 57 21 90 20 57 21 70 15 479 -3 231 -10 465 -16 520 -6 55 -14 334 -19 619 -7 489 -9 520 -26 532 -18 14 -32 15 -105 7z" />
                </g>
              </svg>
            </div>
            <span className="hero-logo-name">Centry</span>
          </div>

          <div className="hero-center">
            <h1 className="ccms-reveal" style={{ animationDelay: '100ms' }}>
              Manage your Church,<br />Not your spreadsheets.
            </h1>
            <p className="ccms-reveal" style={{ animationDelay: '200ms' }}>
              The all-in-one platform for modern church administration.
            </p>
          </div>
        </div>

        <div className="login-form-side">
          <div className="login-form-wrap">

            {mode === 'login' && (
              <>
                <h2 className="form-heading ccms-reveal" style={{ animationDelay: '150ms' }}>Welcome back</h2>
                <p className="form-sub ccms-reveal" style={{ animationDelay: '200ms' }}>Sign in to your church workspace</p>

                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="field-group ccms-reveal" style={{ animationDelay: '250ms' }}>
                    <label className="field-label" htmlFor="email">Email address</label>
                    <input id="email" type="email" placeholder="name@example.com"
                      className={`field-input${errors.email ? ' has-error' : ''}`} {...register('email')} />
                    {errors.email && <p style={{ fontSize: 13, color: '#EF4444', margin: '5px 0 0' }}>{errors.email.message}</p>}
                  </div>

                  <div className="field-group ccms-reveal" style={{ animationDelay: '300ms' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <label className="field-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                      <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setMode('forgot') }}>Forgot password?</a>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
                        className={`field-input field-input--pw${errors.password ? ' has-error' : ''}`} {...register('password')} />
                      <button type="button" className="pw-toggle" onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon open={showPassword} /></button>
                    </div>
                    {errors.password && <p style={{ fontSize: 13, color: '#EF4444', margin: '5px 0 0' }}>{errors.password.message}</p>}
                  </div>

                  {error && <div className="error-banner ccms-reveal">{error}</div>}

                  <div className="ccms-reveal" style={{ animationDelay: '350ms' }}>
                    <button type="submit" className="continue-btn" disabled={isLoading}>
                      {isLoading ? <><Spinner /> Signing in...</> : 'Continue'}
                    </button>
                  </div>
                </form>

                <div className="signup-link ccms-reveal" style={{ animationDelay: '400ms' }}>
                  Don't have an account yet? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError(null) }}>Sign up</a>
                </div>

                <div className="divider-row ccms-reveal" style={{ animationDelay: '430ms' }}>
                  <div className="divider-line" /><span className="divider-text">Or</span><div className="divider-line" />
                </div>

                <div className="ccms-reveal" style={{ animationDelay: '460ms' }}>
                  <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
                    <GoogleIcon /> Sign in with Google
                  </button>
                </div>

                <div className="terms-text ccms-reveal" style={{ animationDelay: '490ms' }}>
                  By signing in, I confirm that I have carefully read and agree to the{' '}
                  <a href="/privacy" onClick={(e) => { e.preventDefault() }}>Privacy Policy</a> and{' '}
                  <a href="/terms" onClick={(e) => { e.preventDefault() }}>Terms of Service</a>.
                </div>
              </>
            )}

            {mode === 'signup' && !signUpSuccess && (
              <>
                <h2 className="form-heading ccms-reveal" style={{ animationDelay: '150ms' }}>Create an account</h2>
                <p className="form-sub ccms-reveal" style={{ animationDelay: '200ms' }}>Sign up to get started with Centry</p>

                <form onSubmit={handleSignUp}>
                  <div className="field-group ccms-reveal" style={{ animationDelay: '250ms' }}>
                    <label className="field-label" htmlFor="signup-email">Email address</label>
                    <input id="signup-email" type="email" placeholder="name@example.com" className="field-input"
                      value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} />
                  </div>

                  <div className="field-group ccms-reveal" style={{ animationDelay: '300ms' }}>
                    <label className="field-label" htmlFor="signup-password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="signup-password" type={showSignUpPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters" className="field-input field-input--pw"
                        value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} />
                      <button type="button" className="pw-toggle" onClick={() => setShowSignUpPassword(v => !v)}
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}><EyeIcon open={showSignUpPassword} /></button>
                    </div>
                  </div>

                  <div className="field-group ccms-reveal" style={{ animationDelay: '350ms' }}>
                    <label className="field-label" htmlFor="signup-confirm">Confirm password</label>
                    <input id="signup-confirm" type="password" placeholder="Re-enter your password" className="field-input"
                      value={signUpConfirm} onChange={e => setSignUpConfirm(e.target.value)} />
                  </div>

                  {signUpError && <div className="error-banner ccms-reveal">{signUpError}</div>}

                  <div className="ccms-reveal" style={{ animationDelay: '400ms' }}>
                    <button type="submit" className="continue-btn" disabled={signUpLoading}>
                      {signUpLoading ? <><Spinner /> Creating account...</> : 'Sign up'}
                    </button>
                  </div>
                </form>

                <div className="signup-link ccms-reveal" style={{ animationDelay: '430ms' }}>
                  Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setSignUpError(null) }}>Sign in</a>
                </div>

                <div className="divider-row ccms-reveal" style={{ animationDelay: '460ms' }}>
                  <div className="divider-line" /><span className="divider-text">Or</span><div className="divider-line" />
                </div>

                <div className="ccms-reveal" style={{ animationDelay: '490ms' }}>
                  <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
                    <GoogleIcon /> Sign up with Google
                  </button>
                </div>

                <div className="terms-text ccms-reveal" style={{ animationDelay: '520ms' }}>
                  By signing up, I confirm that I have carefully read and agree to the{' '}
                  <a href="/privacy" onClick={(e) => { e.preventDefault() }}>Privacy Policy</a> and{' '}
                  <a href="/terms" onClick={(e) => { e.preventDefault() }}>Terms of Service</a>.
                </div>
              </>
            )}

            {mode === 'signup' && signUpSuccess && (
              <div className="ccms-reveal" style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#E8ECF9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F6BED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, color: '#111', margin: '0 0 6px', fontWeight: 500 }}>Check your email</p>
                <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
                  We sent a verification link to <strong>{signUpEmail}</strong>. Click it to activate your account.
                </p>
                <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); setMode('login'); setSignUpSuccess(false) }}>
                  Back to sign in
                </a>
              </div>
            )}

            {mode === 'forgot' && (
              <>
                <h2 className="form-heading ccms-reveal" style={{ animationDelay: '150ms' }}>Reset your password</h2>
                <p className="form-sub ccms-reveal" style={{ animationDelay: '200ms' }}>We'll send you a link to reset it</p>

                {!resetSent ? (
                  <>
                    <div className="field-group ccms-reveal" style={{ animationDelay: '250ms' }}>
                      <label className="field-label" htmlFor="reset-email">Email address</label>
                      <input id="reset-email" type="email" placeholder="Enter your account email" className="field-input"
                        value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                    </div>
                    <div className="ccms-reveal" style={{ animationDelay: '300ms' }}>
                      <button type="button" className="continue-btn" onClick={handlePasswordReset}
                        disabled={resetSending || !resetEmail.trim()}>
                        {resetSending ? <><Spinner /> Sending...</> : 'Send reset link'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ccms-reveal" style={{ textAlign: 'center', padding: '12px 0' }}>
                    <p style={{ fontSize: 15, color: '#111', margin: 0 }}>
                      Check <strong>{resetEmail}</strong> for a link to reset your password.
                    </p>
                  </div>
                )}

                <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); setMode('login'); setResetSent(false); setResetEmail('') }}>
                  ← Back to sign in
                </a>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

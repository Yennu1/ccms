import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export function AcceptInvitePage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    // The invite link puts a recovery/invite token in the URL, which
    // supabase-js (detectSessionInUrl: true) automatically exchanges
    // for a session on page load.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setEmail(data.session.user.email ?? '')
        setReady(true)
      } else {
        setError('This invite link is invalid or has expired. Please ask your Super Admin to send a new invite.')
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    toast.success('Welcome to Centry CMS! Your account is ready.')
    navigate('/')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--dm-bg-page, #F7F8FC)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16,
        border: '1px solid #E5E7EB', padding: 32, boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#1B2352',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 16,
          }}>C</div>
          <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: '#1B2352' }}>
            Centry CMS
          </span>
        </div>

        <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: '#1B2352', margin: '20px 0 6px' }}>
          {ready ? 'Set up your account' : 'Checking your invite...'}
        </h1>
        {ready && (
          <p style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
            Create a password for <strong>{email}</strong> to finish setting up your account.
          </p>
        )}

        {ready ? (
          <form onSubmit={handleSubmit}>
            <label style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
              style={{
                width: '100%', height: 44, borderRadius: 8, border: '1px solid #D5D9E8',
                padding: '0 14px', fontSize: 14, marginBottom: 16, outline: 'none',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            />
            <label style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              style={{
                width: '100%', height: 44, borderRadius: 8, border: '1px solid #D5D9E8',
                padding: '0 14px', fontSize: 14, marginBottom: 8, outline: 'none',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            />
            {error && (
              <div style={{ color: '#EF4444', fontSize: 12, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%', height: 44, borderRadius: 8, border: 'none',
                background: '#4F6BED', color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", marginTop: 8,
              }}
            >
              {saving ? 'Setting up...' : 'Set Password & Continue'}
            </button>
          </form>
        ) : (
          <p style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: error ? '#EF4444' : '#6B7280' }}>
            {error || 'Please wait...'}
          </p>
        )}
      </div>
    </div>
  )
}

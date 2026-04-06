import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { router } from './routes'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import './index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
})

supabase.auth.onAuthStateChange(async (_event, session) => {
  const { setUser, setLoading, setLoginError } = useAuthStore.getState()
  try {
    if (!session?.user) {
      setUser(null)
      return
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    console.log('profile fetch result:', profile, profileError)
    if (profile) {
      setLoginError(null)
      setUser({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        branch_id: profile.branch_id,
        org_id: profile.org_id,
      })
    } else {
      // Auth succeeded but no profile row found — sign out and surface the error
      console.error('Profile not found:', profileError?.message)
      await supabase.auth.signOut()
      setUser(null)
      setLoginError('No profile found for this account. Ask your administrator to set up your profile.')
    }
  } catch (err) {
    console.error('Auth state change error:', err)
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
  } finally {
    setLoading(false)
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)

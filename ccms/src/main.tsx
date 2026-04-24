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

// Render the app immediately — don't block on auth
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)

// Handle auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const { setUser, setLoading, setLoginError } = useAuthStore.getState()

  console.log('Auth event:', event, 'Session:', !!session)

  if (event === 'SIGNED_OUT') {
    setUser(null)
    setLoading(false)
    return
  }

  if (event === 'INITIAL_SESSION') {
    if (!session?.user) {
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      console.log('INITIAL_SESSION profile:', profile, error)

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
        await supabase.auth.signOut()
        setUser(null)
        setLoginError('No profile found for this account.')
      }
    } catch (err) {
      console.error('INITIAL_SESSION error:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
    return
  }

  if (event === 'SIGNED_IN') {
    if (!session?.user) {
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      console.log('SIGNED_IN profile:', profile, error)

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
        await supabase.auth.signOut()
        setUser(null)
        setLoginError('No profile found for this account.')
      }
    } catch (err) {
      console.error('SIGNED_IN error:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
    return
  }

  // Any other event — resolve loading
  setLoading(false)
})
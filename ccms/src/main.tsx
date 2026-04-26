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

// CRITICAL: Register auth listener BEFORE rendering
// so INITIAL_SESSION event is never missed
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔑 Auth event:', event, '| Has session:', !!session)
  const { setUser, setLoading, setLoginError } = useAuthStore.getState()

  // Set loading true immediately for any event that might have a session
 // Only set loading for events that require a full profile fetch
// TOKEN_REFRESHED should never trigger a loading state
if (event !== 'SIGNED_OUT' && event !== 'TOKEN_REFRESHED') {
  setLoading(true)
}

  if (event === 'SIGNED_OUT' || !session?.user) {
    setUser(null)
    setLoading(false)
    return
  }

  if (
    event === 'INITIAL_SESSION' ||
    event === 'SIGNED_IN' ||
    event === 'TOKEN_REFRESHED' ||
    event === 'USER_UPDATED'
  ) {
   if (event === 'TOKEN_REFRESHED') {
  const currentUser = useAuthStore.getState().user
  if (currentUser && currentUser.id === session.user.id) {
    // User already in store, just ensure loading is false
    setLoading(false)
    return
  }
  // User not in store but token refreshed — fetch profile silently
  // without setting loading state so UI doesn't flash
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (profile) {
      setUser({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        branch_id: profile.branch_id,
        org_id: profile.org_id,
      })
    }
  } catch (err) {
    console.error('Token refresh profile fetch error:', err)
  }
  setLoading(false)
  return
}

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile && !error) {
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
        setLoginError('No profile found. Contact your administrator.')
      }
    } catch (err) {
      console.error('Auth error:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
    return
  }

  setLoading(false)
})

// Render AFTER listener is registered
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
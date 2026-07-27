import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'finance_officer'
  | 'group_leader'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  full_name: string
  branch_id: string | null
  org_id: string
}

interface AuthContextValue {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  passwordRecovery: boolean
  mustSetPassword: boolean
  signOut: () => Promise<void>
  clearPasswordRecovery: () => void
  clearMustSetPassword: () => void
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  passwordRecovery: false,
  mustSetPassword: false,
  signOut: async () => {},
  clearPasswordRecovery: () => {},
  clearMustSetPassword: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [mustSetPassword, setMustSetPassword] = useState(false)
  // Once the user completes password setup we latch this ON for the rest of the
  // session, so a late profile refetch (e.g. the USER_UPDATED that updateUser
  // fires) can never re-derive mustSetPassword=true and trap them in a loop.
  const passwordSetupDone = useRef(false)

  // EFFECT 1: Manage session — official Supabase pattern
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
        }
        setSession(session)
        if (!session) {
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // EFFECT 2: Fetch profile when session changes — separate concern
  useEffect(() => {
    if (!session?.user) return

    let cancelled = false

    const fetchProfile = async () => {
      const [profileResult, roleResult] = await Promise.all([
           supabase.from('profiles').select('id, email, full_name, org_id, password_set').eq('id', session.user.id).single(),
           supabase.from('user_roles').select('role, branch_id').eq('user_id', session.user.id).eq('is_active', true).single()
             ])

  if (cancelled) return

        if (profileResult.data && roleResult.data) {
          setUser({
            id: profileResult.data.id,
            email: profileResult.data.email,
            full_name: profileResult.data.full_name,
            org_id: profileResult.data.org_id,
            role: roleResult.data.role as UserRole,
            branch_id: roleResult.data.branch_id,
          })
          // Server-truth gate: an invited user whose profile has never had a
          // password set (password_set = false) must be routed to /accept-invite,
          // regardless of what the invite URL did or didn't contain. Latched off
          // once setup completes so a refetch can't re-trap the user.
          setMustSetPassword(!passwordSetupDone.current && profileResult.data.password_set === false)
        } else {
          await supabase.auth.signOut()
          setUser(null)
        }
        setLoading(false)
            }

    fetchProfile()

    return () => { cancelled = true }
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)
  const clearMustSetPassword = () => {
    passwordSetupDone.current = true
    setMustSetPassword(false)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, passwordRecovery, mustSetPassword, signOut, clearPasswordRecovery, clearMustSetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

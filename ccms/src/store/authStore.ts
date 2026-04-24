import { create } from 'zustand'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  loginError: string | null
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  setLoginError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  loginError: null,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoginError: (loginError) => set({ loginError }),
}))

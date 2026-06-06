import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Change these for quick testing (e.g. 60_000 / 30_000), restore to 30 min / 2 min for production
const TIMEOUT_MS = 30 * 60 * 1000
const WARNING_BEFORE_MS = 2 * 60 * 1000
const THROTTLE_MS = 30 * 1000

export function useSessionTimeout() {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_BEFORE_MS / 1000)

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const throttledRef = useRef(false)
  const warningActiveRef = useRef(false)

  const clearAll = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null }
    if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const doLogout = useCallback(async () => {
    clearAll()
    warningActiveRef.current = false
    setShowWarning(false)
    await supabase.auth.signOut()
    navigateRef.current('/login', { replace: true })
  }, [clearAll])

  const startTimers = useCallback(() => {
    clearAll()
    warningTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true
      setShowWarning(true)
      setSecondsLeft(WARNING_BEFORE_MS / 1000)
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => Math.max(0, s - 1))
      }, 1000)
      logoutTimerRef.current = setTimeout(() => {
        doLogout()
      }, WARNING_BEFORE_MS)
    }, TIMEOUT_MS - WARNING_BEFORE_MS)
  }, [clearAll, doLogout])

  const stayLoggedIn = useCallback(() => {
    warningActiveRef.current = false
    setShowWarning(false)
    startTimers()
  }, [startTimers])

  const logoutNow = useCallback(() => {
    doLogout()
  }, [doLogout])

  useEffect(() => {
    startTimers()

    const handleActivity = () => {
      if (warningActiveRef.current) return
      if (throttledRef.current) return
      throttledRef.current = true
      setTimeout(() => { throttledRef.current = false }, THROTTLE_MS)
      startTimers()
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      clearAll()
      events.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [startTimers, clearAll])

  return { showWarning, secondsLeft, stayLoggedIn, logoutNow }
}

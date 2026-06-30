import React, { createContext, useContext, useState, useEffect } from 'react'

interface SidebarContextType {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  toggleMobile: () => void
  closeMobile: () => void
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false, mobileOpen: false,
  toggleCollapsed: () => {}, toggleMobile: () => {},
  closeMobile: () => {}, isMobile: false
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const toggleCollapsed = () => setCollapsed(p => !p)
  const toggleMobile = () => setMobileOpen(p => !p)
  const closeMobile = () => setMobileOpen(false)

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, toggleCollapsed, toggleMobile, closeMobile, isMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)

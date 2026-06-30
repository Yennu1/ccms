import React, { createContext, useContext, useState, useEffect } from 'react'

interface SettingsContextType {
  isOpen: boolean
  activeTab: string
  openSettings: (tab?: string) => void
  closeSettings: () => void
  setActiveTab: (tab: string) => void
}

const SettingsContext = createContext<SettingsContextType>({
  isOpen: false, activeTab: 'profile',
  openSettings: () => {}, closeSettings: () => {}, setActiveTab: () => {}
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const openSettings = (tab = 'profile') => {
    setActiveTab(tab)
    setIsOpen(true)
  }
  const closeSettings = () => setIsOpen(false)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <SettingsContext.Provider value={{ isOpen, activeTab, openSettings, closeSettings, setActiveTab }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)

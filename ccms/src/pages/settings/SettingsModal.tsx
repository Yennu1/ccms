import { useRef } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { useSidebar } from '../../contexts/SidebarContext'
import { SettingsPage } from './SettingsPage'

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettings()
  const { isMobile } = useSidebar()
  const backdropRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) closeSettings() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '24px',
        animation: 'settingsFadeIn 0.18s ease',
      }}
    >
      {/* Modal panel */}
      <div style={{
        background: 'var(--dm-bg-card)',
        borderRadius: isMobile ? '16px 16px 0 0' : 16,
        width: '100%',
        maxWidth: isMobile ? '100%' : 900,
        height: isMobile ? '92vh' : '85vh',
        maxHeight: isMobile ? '92vh' : 700,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        animation: 'settingsSlideUp 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '0.5px solid var(--dm-border-soft)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', system-ui",
            fontSize: 18, fontWeight: 700,
            color: 'var(--dm-text-ink)',
          }}>Settings</span>
          <button
            onClick={closeSettings}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '0.5px solid var(--dm-border)',
              background: 'var(--dm-bg-card)',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--dm-text-secondary)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* SettingsPage content fills the rest */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SettingsPage modal />
        </div>
      </div>

      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0 } to { opacity: 1 }
        }
        @keyframes settingsSlideUp {
          from { opacity: 0; transform: scale(0.96) translateY(8px) }
          to { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </div>
  )
}

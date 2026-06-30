import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { SessionTimeoutWarning } from '../components/SessionTimeoutWarning'
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext'
import { SettingsProvider } from '../contexts/SettingsContext'
import { SettingsModal } from '../pages/settings/SettingsModal'

function AppLayoutInner() {
  const { collapsed, mobileOpen, closeMobile, isMobile } = useSidebar()
  const { showWarning, secondsLeft, stayLoggedIn, logoutNow } = useSessionTimeout()
  const sidebarWidth = isMobile ? 0 : collapsed ? 60 : 220

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        {/* Mobile overlay backdrop */}
        {isMobile && mobileOpen && (
          <div
            onClick={closeMobile}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
        )}
        {/* Right column — offset by sidebar width */}
        <div style={{
          marginLeft: sidebarWidth,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <TopBar />
          <main style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--dm-bg-page)',
            padding: isMobile ? 16 : 24,
          }}>
            <Outlet />
          </main>
          <Toaster richColors position="top-right" />
        </div>
      </div>
      {showWarning && (
        <SessionTimeoutWarning
          secondsLeft={secondsLeft}
          onStayLoggedIn={stayLoggedIn}
          onLogoutNow={logoutNow}
        />
      )}
      <SettingsModal />
    </>
  )
}

export function AppLayout() {
  return (
    <SettingsProvider>
      <SidebarProvider>
        <AppLayoutInner />
      </SidebarProvider>
    </SettingsProvider>
  )
}

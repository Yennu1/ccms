import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      {/* Right column — offset by sidebar width */}
      <div style={{
        marginLeft: 220,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <TopBar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--dm-bg-page)',
          padding: 24,
        }}>
          <Outlet />
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </div>
  )
}

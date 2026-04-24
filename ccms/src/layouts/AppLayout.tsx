import { Outlet } from 'react-router-dom'
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
          background: '#F4F5F7',
          padding: 24,
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

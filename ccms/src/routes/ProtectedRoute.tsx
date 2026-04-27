import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, type UserRole } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0D14',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid #1B2352',
          borderTopColor: '#4F6BED',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

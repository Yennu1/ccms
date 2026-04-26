import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from '../pages/auth/LoginPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { MembersPage } from '../pages/members/MembersPage'
import { MemberNewPage } from '../pages/members/MemberNewPage'
import { MemberProfilePage } from '../pages/members/MemberProfilePage'
import { MemberEditPage } from '../pages/members/MemberEditPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/members', element: <MembersPage /> },
          { path: '/members/new', element: <MemberNewPage /> },
          { path: '/members/:id', element: <MemberProfilePage /> },
          { path: '/members/:id/edit', element: <MemberEditPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTE } from '../lib/constants'
import { LoginPage } from '../pages/auth/LoginPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { MembersPage } from '../pages/members/MembersPage'
import { MemberNewPage } from '../pages/members/MemberNewPage'
import { MemberProfilePage } from '../pages/members/MemberProfilePage'
import { MemberEditPage } from '../pages/members/MemberEditPage'
import { MemberImportPage } from '../pages/members/MemberImportPage'
import { HouseholdsPage } from '../pages/members/HouseholdsPage'
import { HouseholdNewPage } from '../pages/members/HouseholdNewPage'
import { HouseholdProfilePage } from '../pages/members/HouseholdProfilePage'
import { DonationsPage } from '../pages/donations/DonationsPage'
import { RecordGivingPage } from '../pages/donations/RecordGivingPage'
import { TransactionDetailPage } from '../pages/donations/TransactionDetailPage'
import { PledgesPage } from '../pages/donations/PledgesPage'
import { AddPledgePage } from '../pages/donations/AddPledgePage'
import { EditTransactionPage } from '../pages/donations/EditTransactionPage'
import { EditPledgePage } from '../pages/donations/EditPledgePage'
import { EventsListPage } from '../pages/events/EventsListPage'
import { CreateEventPage } from '../pages/events/CreateEventPage'
import { EditEventPage } from '../pages/events/EditEventPage'
import { EventDetailPage } from '../pages/events/EventDetailPage'
import { CalendarViewPage } from '../pages/events/CalendarViewPage'
import { MinistriesPage } from '../pages/groups/MinistriesPage'
import { MinistryNewPage } from '../pages/groups/MinistryNewPage'
import { MinistryDetailPage } from '../pages/groups/MinistryDetailPage'
import { GroupNewPage } from '../pages/groups/GroupNewPage'
import { GroupDetailPage } from '../pages/groups/GroupDetailPage'
import { ReportsPage } from '../pages/reports/ReportsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'

function HouseholdProfileRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/members/households/${id}`} replace />
}

// Rendered inside ProtectedRoute, so user is guaranteed to be loaded
function RoleHomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={ROLE_HOME_ROUTE[user?.role ?? ''] ?? '/dashboard'} replace />
}

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
          { path: '/', element: <RoleHomeRedirect /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/members', element: <MembersPage /> },
          { path: '/members/import', element: <MemberImportPage /> },
          { path: '/members/new', element: <MemberNewPage /> },
          { path: '/members/households', element: <HouseholdsPage /> },
          { path: '/members/households/new', element: <HouseholdNewPage /> },
          { path: '/members/households/:id', element: <HouseholdProfilePage /> },
          { path: '/members/:id', element: <MemberProfilePage /> },
          { path: '/members/:id/edit', element: <MemberEditPage /> },
          // Backwards-compatible redirects
          { path: '/households', element: <Navigate to="/members/households" replace /> },
          { path: '/households/new', element: <Navigate to="/members/households/new" replace /> },
          { path: '/households/:id', element: <HouseholdProfileRedirect /> },
          { path: '/donations', element: <DonationsPage /> },
          { path: '/donations/new', element: <RecordGivingPage /> },
          { path: '/donations/pledges', element: <PledgesPage /> },
          { path: '/donations/pledges/new', element: <AddPledgePage /> },
          { path: '/donations/pledges/:id/edit', element: <EditPledgePage /> },
          { path: '/donations/:id/edit', element: <EditTransactionPage /> },
          { path: '/donations/:id', element: <TransactionDetailPage /> },
          { path: '/events', element: <EventsListPage /> },
          { path: '/events/calendar', element: <CalendarViewPage /> },
          { path: '/events/new', element: <CreateEventPage /> },
          { path: '/events/:id', element: <EventDetailPage /> },
          { path: '/events/:id/edit', element: <EditEventPage /> },
          { path: '/groups', element: <MinistriesPage /> },
          { path: '/groups/new', element: <MinistryNewPage /> },
          { path: '/groups/:ministryId', element: <MinistryDetailPage /> },
          { path: '/groups/:ministryId/new', element: <GroupNewPage /> },
          { path: '/groups/:ministryId/:groupId', element: <GroupDetailPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/settings', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

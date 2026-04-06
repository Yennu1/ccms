import { useAuthStore } from '../../store/authStore'

export function DashboardPage() {
  const { user } = useAuthStore()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="text-zinc-500 mt-1">Welcome back, {user?.full_name}.</p>
    </div>
  )
}

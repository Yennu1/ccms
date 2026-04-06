import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-zinc-900">404</h1>
      <p className="text-zinc-500">This page doesn't exist.</p>
      <Button asChild><Link to="/dashboard">Go to dashboard</Link></Button>
    </div>
  )
}

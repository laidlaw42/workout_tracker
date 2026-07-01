import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Placeholder — implemented in Phase 9.
export default function SessionSummaryScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Workout complete</h1>
      <p className="text-muted-foreground">Summary for session {id} coming soon.</p>
      <div className="flex gap-3">
        <Button onClick={() => navigate('/home')}>Done</Button>
        <Button variant="outline" onClick={() => navigate(`/history/${id}`)}>
          View details
        </Button>
      </div>
    </div>
  )
}

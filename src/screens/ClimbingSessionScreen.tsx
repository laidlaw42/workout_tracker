import { useParams } from 'react-router-dom'

// Placeholder — implemented in Phase 8.
export default function ClimbingSessionScreen() {
  const { id } = useParams()
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Climbing session</h1>
      <p className="text-muted-foreground">Session {id} — logging coming soon.</p>
    </div>
  )
}

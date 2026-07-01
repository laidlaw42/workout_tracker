import { useParams } from 'react-router-dom'

// Placeholder — implemented in Phase 7.
export default function CardioSessionScreen() {
  const { id } = useParams()
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Cardio session</h1>
      <p className="text-muted-foreground">Session {id} — logging coming soon.</p>
    </div>
  )
}

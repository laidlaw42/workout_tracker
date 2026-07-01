import { useParams } from 'react-router-dom'

// Placeholder — implemented in Phase 6.
export default function StrengthSessionScreen() {
  const { id } = useParams()
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Strength session</h1>
      <p className="text-muted-foreground">Session {id} — logging coming soon.</p>
    </div>
  )
}

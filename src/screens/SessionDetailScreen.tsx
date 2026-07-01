import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'

// Placeholder — implemented in Phase 10.
export default function SessionDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh">
      <PageHeader title="Session detail" onBack={() => navigate('/history')} />
      <p className="p-4 text-muted-foreground">Details for session {id} coming soon.</p>
    </div>
  )
}

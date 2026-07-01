import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'

// Placeholder — implemented in Phase 5.
export default function TemplateEditScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh">
      <PageHeader title="Edit template" onBack={() => navigate(`/library/${id}`)} />
      <p className="p-4 text-muted-foreground">Editing coming soon.</p>
    </div>
  )
}

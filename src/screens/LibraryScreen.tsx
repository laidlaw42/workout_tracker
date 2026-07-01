import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Dumbbell } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteTemplate, getTemplatesByType } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TemplateCard } from '@/components/TemplateCard'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { WorkoutTemplate } from '@/types'

type Filter = 'all' | 'strength' | 'cardio'

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
]

export default function LibraryScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('type')
  const [filter, setFilter] = useState<Filter>(
    initial === 'strength' || initial === 'cardio' ? initial : 'all',
  )
  const [toDelete, setToDelete] = useState<WorkoutTemplate | null>(null)

  const templates = useLiveQuery(
    () => getTemplatesByType(filter === 'all' ? undefined : filter),
    [filter],
  )

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await deleteTemplate(toDelete.id)
      toast.success(`Deleted "${toDelete.name}"`)
    } catch {
      toast.error('Could not delete template')
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-2xl font-bold">Library</h1>
      <SegmentedControl options={OPTIONS} value={filter} onChange={setFilter} />

      {templates === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No templates here"
          subtitle="Templates you create will appear in this list."
        />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onOpen={() => navigate(`/library/${t.id}`)}
              onDelete={() => setToDelete(t)}
            />
          ))}
        </div>
      )}

      <p className="px-1 text-center text-xs text-muted-foreground">
        Tip: press and hold a template to delete it.
      </p>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template. Logged workouts from it are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

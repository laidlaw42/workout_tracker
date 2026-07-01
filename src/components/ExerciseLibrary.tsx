import { useMemo, useState } from 'react'
import { ChevronRight, Dumbbell, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { getAllExercises, getAllTemplates } from '@/db/helpers'
import { ExerciseFormSheet } from '@/components/ExerciseFormSheet'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Exercise, TrackingType } from '@/types'

const TRACKING_LABEL: Record<TrackingType, string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
}

export function ExerciseLibrary() {
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const templates = useLiveQuery(() => getAllTemplates(), [])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  const usage = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of templates ?? []) {
      for (const e of t.exercises) map.set(e.exerciseId, (map.get(e.exerciseId) ?? 0) + 1)
    }
    return map
  }, [templates])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(ex: Exercise) {
    setEditing(ex)
    setFormOpen(true)
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full" onClick={openNew}>
        <Plus className="size-4" /> Add exercise
      </Button>

      {exercises === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No exercises" subtitle="Add your first exercise." />
      ) : (
        <div className="space-y-2">
          {exercises.map((ex) => {
            const used = usage.get(ex.id) ?? 0
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => openEdit(ex)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-accent"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{ex.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {TRACKING_LABEL[ex.trackingType]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {ex.muscleGroups.length > 0 ? ex.muscleGroups.join(', ') : 'No muscle groups'}
                    {used > 0 && ` · in ${used} workout${used === 1 ? '' : 's'}`}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )
          })}
        </div>
      )}

      <ExerciseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        exercise={editing}
        usageCount={editing ? (usage.get(editing.id) ?? 0) : 0}
        onSaved={() => setEditing(null)}
      />
    </div>
  )
}

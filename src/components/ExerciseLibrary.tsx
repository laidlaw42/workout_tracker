import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight, Dumbbell, Pencil, Play, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import {
  getAllExercises,
  getAllTemplates,
  getDefaultTags,
  startSessionFromExercise,
} from '@/db/helpers'
import { ExerciseFormSheet } from '@/components/ExerciseFormSheet'
import { EmptyState } from '@/components/EmptyState'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Exercise, TrackingType } from '@/types'

const TRACKING_LABEL: Record<TrackingType, string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
}

export function ExerciseLibrary() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const templates = useLiveQuery(() => getAllTemplates(), [])
  const defaultTags = useLiveQuery(() => getDefaultTags(), []) ?? []
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  // A59 — start a template-less session pre-loaded with just this exercise, then
  // jump straight into it. Only offered for set-based (non-distance) exercises.
  async function startAsWorkout(ex: Exercise) {
    try {
      const id = await startSessionFromExercise(ex)
      navigate(`/session/strength/${id}`)
    } catch {
      toast.error('Could not start workout')
    }
  }

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
            // Distance (cardio) exercises aren't set-based, so "Start as workout"
            // (A59) doesn't apply — those cards have no context menu.
            const canStart = ex.trackingType !== 'distance'
            const card = (
              <button
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
            if (!canStart) return <div key={ex.id}>{card}</div>
            return (
              <ContextMenu key={ex.id}>
                <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => void startAsWorkout(ex)}>
                    <Play /> Start as workout
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => openEdit(ex)}>
                    <Pencil /> Edit exercise
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      )}

      <ExerciseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        exercise={editing}
        usageCount={editing ? (usage.get(editing.id) ?? 0) : 0}
        defaultTags={defaultTags}
        onSaved={() => setEditing(null)}
      />
    </div>
  )
}

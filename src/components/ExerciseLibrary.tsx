import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight, Dumbbell, Pencil, Play, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useTagColours } from '@/hooks/useTagColours'
import {
  getAllExercises,
  getAllTemplates,
  getDefaultTags,
  startSessionFromExercise,
} from '@/db/helpers'
import { ExerciseFormSheet } from '@/components/ExerciseFormSheet'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedControl } from '@/components/SegmentedControl'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { badgeForCategory } from '@/lib/badges'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Exercise, ExerciseCategory, TrackingType } from '@/types'

const TRACKING_LABEL: Record<TrackingType, string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
}

// A74 — category filter tabs mirror the workout-template row (All + the five
// exercise categories). Filtering is a straight match on `ex.category`.
type CatFilter = 'all' | ExerciseCategory

// A79 — fixed order: All, Strength, Cardio, Hangboard, Climbing, Rehab.
const CATEGORY_OPTIONS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
]

export function ExerciseLibrary() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const templates = useLiveQuery(() => getAllTemplates(), [])
  const defaultTags = useLiveQuery(() => getDefaultTags(), []) ?? []
  const tagColour = useTagColours()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  // A74 — filters are local to this view and reset when it unmounts (switching
  // away from the Exercises tab). Category is single-select; tags are AND-combined.
  const [catFilter, setCatFilter] = useState<CatFilter>('all')
  const [activeTags, setActiveTags] = useState<string[]>([])

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

  // Category slice first — the tag pills only show tags present in this slice.
  const byCategory = useMemo(
    () => (exercises ?? []).filter((ex) => catFilter === 'all' || ex.category === catFilter),
    [exercises, catFilter],
  )

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const ex of byCategory) for (const tag of ex.tags) set.add(tag)
    return [...set].sort()
  }, [byCategory])

  // Tag AND-filter, then alphabetical sort.
  const visible = useMemo(
    () =>
      byCategory
        .filter((ex) => activeTags.every((tag) => ex.tags.includes(tag)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [byCategory, activeTags],
  )

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
        <Plus className="size-4" /> Add new exercise
      </Button>

      <SegmentedControl
        options={CATEGORY_OPTIONS}
        value={catFilter}
        onChange={(v) => {
          setCatFilter(v)
          setActiveTags([])
        }}
      />

      {availableTags.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {availableTags.map((tag) => {
            const on = activeTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setActiveTags((cur) => (on ? cur.filter((t) => t !== tag) : [...cur, tag]))
                }
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                  on
                    ? 'bg-primary text-primary-foreground ring-primary'
                    : 'bg-muted text-muted-foreground ring-transparent',
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: tagColour(tag) }} />
                #{tag}
              </button>
            )
          })}
        </div>
      )}

      {exercises === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No exercises"
          subtitle={
            exercises.length === 0
              ? 'Add your first exercise.'
              : activeTags.length > 0
                ? 'No exercises match these tags.'
                : 'No exercises in this category.'
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((ex) => {
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
                    <DisciplineBadge
                      badge={badgeForCategory(ex.category)}
                      className="shrink-0"
                    />
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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

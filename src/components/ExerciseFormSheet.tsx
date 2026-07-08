import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteExercise, updateExercise, upsertExercise } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import {
  MetricsFields,
  exerciseToMetricsDraft,
  metricsDraftToStored,
  type MetricsDraft,
} from '@/components/MetricsFields'
import { metricsToConfig } from '@/lib/metrics'
import { TagInput } from '@/components/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import type { Exercise, ExerciseCategory } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: Exercise | null // null = create
  usageCount?: number
  /** Tags pre-applied to a new exercise (A35). Ignored when editing. */
  defaultTags?: string[]
  /** Category / name pre-filled for a new exercise (e.g. the picker's scope + search). */
  defaultCategory?: ExerciseCategory
  defaultName?: string
  onSaved?: (id: string) => void
}

// A93 — alphabetical category order (value selector; default stays 'strength').
const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'strength', label: 'Strength' },
]

export function ExerciseFormSheet({
  open,
  onOpenChange,
  exercise,
  usageCount = 0,
  defaultTags = [],
  defaultCategory = 'strength',
  defaultName = '',
  onSaved,
}: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [muscles, setMuscles] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [tags, setTags] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The Parameters draft: which metrics the exercise tracks + their defaults.
  const [metrics, setMetrics] = useState<MetricsDraft>(() => exerciseToMetricsDraft(null))

  // Seed on open only. `defaultTags` is intentionally not a dependency: it is read
  // once at open time for a new exercise, so a later live update never clobbers
  // edits (and never overwrites an existing exercise's own tags).
  useEffect(() => {
    if (!open) return
    setName(exercise?.name ?? defaultName)
    setDescription(exercise?.notes ?? '')
    setMuscles(exercise?.muscleGroups.join(', ') ?? '')
    setCategory(exercise?.category ?? defaultCategory)
    setTags(exercise?.tags ?? defaultTags)
    setMetrics(exerciseToMetricsDraft(exercise))
  }, [open, exercise])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const muscleGroups = muscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    // Metrics are the source of truth; trackingType + the weight/edge flags are
    // derived from them so the set row / PR / progress code stays unchanged.
    const { metrics: enabled, defaults } = metricsDraftToStored(metrics)
    const config = metricsToConfig(enabled)
    const record = {
      name: trimmed,
      category,
      muscleGroups,
      tags,
      notes: trimmed && description.trim() ? description.trim() : undefined,
      metrics: enabled,
      defaults,
      ...config,
    }
    try {
      let id: string
      if (exercise) {
        await updateExercise(exercise.id, record)
        id = exercise.id
      } else {
        id = await upsertExercise(record)
      }
      onSaved?.(id)
      onOpenChange(false)
    } catch {
      toast.error('Could not save exercise')
    }
  }

  async function remove() {
    if (!exercise) return
    try {
      await deleteExercise(exercise.id)
      toast.success(`Deleted "${exercise.name}"`)
      setConfirmDelete(false)
      onOpenChange(false)
    } catch {
      toast.error('Could not delete exercise')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{exercise ? 'Edit exercise' : 'New exercise'}</SheetTitle>
          <SheetDescription className="sr-only">Exercise details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-2">
            <Label htmlFor="ex-form-name">Name</Label>
            <Input
              id="ex-form-name"
              value={name}
              placeholder="e.g. Front squat"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-form-desc">Description</Label>
            <Textarea
              id="ex-form-desc"
              value={description}
              placeholder="optional — cues, setup, notes"
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-form-muscles">Muscle groups</Label>
            <Input
              id="ex-form-muscles"
              value={muscles}
              placeholder="comma separated, e.g. quads, glutes"
              onChange={(e) => setMuscles(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <SegmentedControl options={CATEGORIES} value={category} onChange={setCategory} />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} />
          </div>
          {/* The Parameters section: which metrics this exercise tracks + defaults. */}
          <MetricsFields value={metrics} onChange={setMetrics} />
          {exercise && (
            <Button
              variant="ghost"
              className="w-full text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete exercise
            </Button>
          )}
        </div>

        <div className="flex gap-3 border-t border-border p-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{exercise?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usageCount > 0
                ? `It's used in ${usageCount} workout${usageCount === 1 ? '' : 's'} — those keep their copy. `
                : ''}
              Past logged workouts are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

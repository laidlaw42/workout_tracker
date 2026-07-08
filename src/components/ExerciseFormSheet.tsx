import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteExercise, updateExercise, upsertExercise } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import {
  ExerciseDefaultsFields,
  EMPTY_DEFAULTS,
  defaultsToDraft,
  draftToDefaults,
  type DefaultsDraft,
} from '@/components/ExerciseDefaultsFields'
import {
  TrackingOptionsFields,
  DEFAULT_TRACKING_CONFIG,
  configToDraft,
  draftToConfig,
  type TrackingConfigDraft,
} from '@/components/TrackingOptionsFields'
import { TagInput } from '@/components/TagInput'
import { TRACKING_TYPES } from '@/lib/trackingTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { Exercise, ExerciseCategory, TrackingType } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: Exercise | null // null = create
  usageCount?: number
  /** Tags pre-applied to a new exercise (A35). Ignored when editing. */
  defaultTags?: string[]
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
  onSaved,
}: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [muscles, setMuscles] = useState('')
  const [tracking, setTracking] = useState<TrackingType>('reps')
  const [tags, setTags] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A98 — optional default parameters (held as a string draft; blank = unset →
  // falls back to the hardcoded add-to-template defaults).
  const [defDraft, setDefDraft] = useState<DefaultsDraft>(EMPTY_DEFAULTS)
  // F51 — the exercise's tracking configuration (which metrics its set row shows).
  const [cfgDraft, setCfgDraft] = useState<TrackingConfigDraft>(DEFAULT_TRACKING_CONFIG)

  // Seed on open only. `defaultTags` is intentionally not a dependency: it is read
  // once at open time for a new exercise, so a later live update never clobbers
  // edits (and never overwrites an existing exercise's own tags).
  useEffect(() => {
    if (!open) return
    setName(exercise?.name ?? '')
    setCategory(exercise?.category ?? 'strength')
    setMuscles(exercise?.muscleGroups.join(', ') ?? '')
    setTracking(exercise?.trackingType ?? 'reps')
    setTags(exercise?.tags ?? defaultTags)
    setDefDraft(defaultsToDraft(exercise?.defaults))
    setCfgDraft(configToDraft(exercise))
  }, [open, exercise])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const muscleGroups = muscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const trackingType: TrackingType = tracking
    // A98 — default parameters; the shared builder keeps only the fields relevant to
    // the tracking type and returns undefined when nothing is set, so an exercise
    // with no defaults stays clean and uses the add fallbacks.
    const defaults = draftToDefaults(trackingType, defDraft)
    // F51 — the tracking config from the user's Tracking-options draft (every
    // category, hangboard included; a grip is a standard duration exercise).
    const config = draftToConfig(trackingType, cfgDraft)
    try {
      let id: string
      if (exercise) {
        await updateExercise(exercise.id, {
          name: trimmed,
          category,
          muscleGroups,
          trackingType,
          tags,
          defaults,
          ...config,
        })
        id = exercise.id
      } else {
        id = await upsertExercise({
          name: trimmed,
          category,
          muscleGroups,
          trackingType,
          tags,
          defaults,
          ...config,
        })
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
            <Label>Category</Label>
            <SegmentedControl options={CATEGORIES} value={category} onChange={setCategory} />
          </div>
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
            <Label htmlFor="ex-form-muscles">Muscle groups</Label>
            <Input
              id="ex-form-muscles"
              value={muscles}
              placeholder="comma separated, e.g. quads, glutes"
              onChange={(e) => setMuscles(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tracking</Label>
            <SegmentedControl options={TRACKING_TYPES} value={tracking} onChange={setTracking} />
          </div>
          {/* F51 — the tracking configuration: which metrics the set row shows. No
              field is locked or inferred from category/name (hangboard included). */}
          <TrackingOptionsFields
            tracking={tracking}
            value={cfgDraft}
            onChange={(patch) => setCfgDraft((c) => ({ ...c, ...patch }))}
          />
          {/* A98 — default parameters, keyed to the tracking type. Pre-fill a new
              template/session row; blank falls back to the standard defaults. */}
          <ExerciseDefaultsFields
            tracking={tracking}
            value={defDraft}
            onChange={(patch) => setDefDraft((d) => ({ ...d, ...patch }))}
          />
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} />
          </div>
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

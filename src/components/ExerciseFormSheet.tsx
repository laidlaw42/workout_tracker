import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteExercise, updateExercise, upsertExercise } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
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
import type { Exercise, TrackingType } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: Exercise | null // null = create
  usageCount?: number
  onSaved?: (id: string) => void
}

const TRACKING: { value: TrackingType; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance', label: 'Distance' },
]

export function ExerciseFormSheet({ open, onOpenChange, exercise, usageCount = 0, onSaved }: Props) {
  const [name, setName] = useState('')
  const [muscles, setMuscles] = useState('')
  const [tracking, setTracking] = useState<TrackingType>('reps')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(exercise?.name ?? '')
    setMuscles(exercise?.muscleGroups.join(', ') ?? '')
    setTracking(exercise?.trackingType ?? 'reps')
  }, [open, exercise])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const muscleGroups = muscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      let id: string
      if (exercise) {
        await updateExercise(exercise.id, { name: trimmed, muscleGroups, trackingType: tracking })
        id = exercise.id
      } else {
        id = await upsertExercise({ name: trimmed, muscleGroups, trackingType: tracking })
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
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{exercise ? 'Edit exercise' : 'New exercise'}</SheetTitle>
          <SheetDescription className="sr-only">Exercise details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor="ex-form-name">Name</Label>
            <Input
              id="ex-form-name"
              value={name}
              autoFocus
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
            <SegmentedControl options={TRACKING} value={tracking} onChange={setTracking} />
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
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

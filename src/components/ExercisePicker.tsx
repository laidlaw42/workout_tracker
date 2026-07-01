import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { getAllExercises, upsertExercise } from '@/db/helpers'
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
import type { Exercise, TrackingType } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (exercise: Exercise) => void
}

const TRACKING: { value: TrackingType; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance', label: 'Distance' },
]

export function ExercisePicker({ open, onOpenChange, onSelect }: Props) {
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [muscles, setMuscles] = useState('')
  const [tracking, setTracking] = useState<TrackingType>('reps')

  function reset() {
    setQuery('')
    setCreating(false)
    setName('')
    setMuscles('')
    setTracking('reps')
  }

  function choose(e: Exercise) {
    onSelect(e)
    onOpenChange(false)
    reset()
  }

  async function createNew() {
    const trimmed = name.trim()
    if (!trimmed) return
    const muscleGroups = muscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const id = await upsertExercise({ name: trimmed, muscleGroups, trackingType: tracking, tags: [] })
      choose({ id, name: trimmed, muscleGroups, trackingType: tracking, tags: [], createdAt: Date.now() })
    } catch {
      toast.error('Could not create exercise')
    }
  }

  const filtered = (exercises ?? []).filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{creating ? 'New exercise' : 'Add exercise'}</SheetTitle>
          <SheetDescription className="sr-only">
            Pick an exercise or create a new one.
          </SheetDescription>
        </SheetHeader>

        {creating ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label htmlFor="ex-name">Name</Label>
              <Input
                id="ex-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front squat"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-muscles">Muscle groups</Label>
              <Input
                id="ex-muscles"
                value={muscles}
                onChange={(e) => setMuscles(e.target.value)}
                placeholder="comma separated, e.g. quads, glutes"
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking</Label>
              <SegmentedControl options={TRACKING} value={tracking} onChange={setTracking} />
            </div>
            <div className="mt-auto flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Back
              </Button>
              <Button className="flex-1" onClick={createNew} disabled={!name.trim()}>
                Create & add
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-border p-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises…"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => choose(e)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors active:bg-accent"
                >
                  <span className="font-medium">{e.name}</span>
                  {e.muscleGroups.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {e.muscleGroups.join(', ')}
                    </span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matching exercises.
                </p>
              )}
            </div>
            <div className="border-t border-border p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCreating(true)
                  setName(query)
                }}
              >
                <Plus className="size-4" /> Create new exercise
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

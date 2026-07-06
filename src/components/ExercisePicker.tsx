import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Exercise, ExerciseCategory, TrackingType } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Multi-select with checkboxes + confirm; otherwise tap-to-add one. */
  multiple?: boolean
  /** Restrict the list (and default new exercises) to these categories (A36).
   *  Omit to show every exercise. */
  categories?: ExerciseCategory[]
  /** Universal mode (A66): show every category grouped under sticky headers with
   *  a category filter tab row (All default). Overrides `categories` filtering. */
  grouped?: boolean
  onSelect: (exercises: Exercise[]) => void
}

const TRACKING: { value: TrackingType; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance', label: 'Distance' },
]

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
]

// Grouping order + labels for the universal picker (A66).
const GROUP_ORDER: ExerciseCategory[] = ['strength', 'climbing', 'rehab', 'cardio']
const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  climbing: 'Climbing',
  rehab: 'Rehab',
  cardio: 'Cardio',
}
type CatFilter = 'all' | ExerciseCategory
const GROUP_TABS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...GROUP_ORDER.map((c) => ({ value: c as CatFilter, label: CATEGORY_LABEL[c] })),
]

export function ExercisePicker({
  open,
  onOpenChange,
  multiple = false,
  categories,
  grouped = false,
  onSelect,
}: Props) {
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const defaultCategory = categories?.[0] ?? 'strength'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([]) // ids, in selection order
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>(defaultCategory)
  const [muscles, setMuscles] = useState('')
  const [tracking, setTracking] = useState<TrackingType>('reps')
  const [catFilter, setCatFilter] = useState<CatFilter>('all') // universal mode (A66)

  function reset() {
    setQuery('')
    setSelected([])
    setCreating(false)
    setName('')
    setCategory(defaultCategory)
    setMuscles('')
    setTracking('reps')
    setCatFilter('all')
  }

  function finish(chosen: Exercise[]) {
    onSelect(chosen)
    onOpenChange(false)
    reset()
  }

  function onRow(e: Exercise) {
    if (multiple) {
      setSelected((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]))
    } else {
      finish([e])
    }
  }

  function confirmMulti() {
    const all = exercises ?? []
    const chosen = selected
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Exercise => e != null)
    if (chosen.length) finish(chosen)
  }

  async function createNew() {
    const trimmed = name.trim()
    if (!trimmed) return
    const muscleGroups = muscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const id = await upsertExercise({ name: trimmed, category, muscleGroups, trackingType: tracking, tags: [] })
      finish([{ id, name: trimmed, category, muscleGroups, trackingType: tracking, tags: [], createdAt: Date.now() }])
    } catch {
      toast.error('Could not create exercise')
    }
  }

  const filtered = (exercises ?? []).filter(
    (e) =>
      e.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (grouped
        ? catFilter === 'all' || e.category === catFilter
        : !categories || categories.includes(e.category)),
  )

  // A row (checkbox in multi-select) for one exercise.
  function renderRow(e: Exercise) {
    const isSelected = selected.includes(e.id)
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => onRow(e)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:bg-accent"
      >
        {multiple && (
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded border',
              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
            )}
          >
            {isSelected && <Check className="size-3.5" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{e.name}</span>
          {e.muscleGroups.length > 0 && (
            <span className="block text-xs text-muted-foreground">{e.muscleGroups.join(', ')}</span>
          )}
        </span>
      </button>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <SheetContent
        side="bottom"
        className="flex h-[85dvh] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{creating ? 'New exercise' : 'Add exercise'}</SheetTitle>
          <SheetDescription className="sr-only">
            Pick an exercise or create a new one.
          </SheetDescription>
        </SheetHeader>

        {creating ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <SegmentedControl options={CATEGORIES} value={category} onChange={setCategory} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-name">Name</Label>
              <Input
                id="ex-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front squat"
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
            <div className="space-y-3 border-b border-border p-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises…"
              />
              {grouped && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                  {GROUP_TABS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setCatFilter(t.value)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                        catFilter === t.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground active:bg-accent',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {grouped && catFilter === 'all' ? (
                // Grouped by category with a sticky header per group (A66).
                GROUP_ORDER.map((cat) => {
                  const items = filtered.filter((e) => e.category === cat)
                  if (items.length === 0) return null
                  return (
                    <div key={cat}>
                      <p className="sticky top-0 z-10 bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABEL[cat]}
                      </p>
                      {items.map(renderRow)}
                    </div>
                  )
                })
              ) : (
                filtered.map(renderRow)
              )}
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matching exercises.
                </p>
              )}
            </div>
            <div className="space-y-2 border-t border-border p-4">
              {multiple && selected.length > 0 && (
                <Button className="w-full" onClick={confirmMulti}>
                  Add {selected.length} exercise{selected.length === 1 ? '' : 's'}
                </Button>
              )}
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

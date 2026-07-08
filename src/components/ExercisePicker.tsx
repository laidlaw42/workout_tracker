import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { getAllExercises, setExerciseFavorite } from '@/db/helpers'
import { FavoriteButton, FavoriteFilterButton } from '@/components/FavoriteButton'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { ExerciseFormSheet } from '@/components/ExerciseFormSheet'
import { badgeForCategory, categoryPillClasses } from '@/lib/badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Exercise, ExerciseCategory } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Multi-select with checkboxes + confirm; otherwise tap-to-add one. */
  multiple?: boolean
  /** Restrict the list, the category tabs, and default new exercises to these
   *  categories (A36). Omit to show every category. */
  categories?: ExerciseCategory[]
  onSelect: (exercises: Exercise[]) => void
}

// Grouping order + labels for the universal picker (A66, A73). A93 — strictly
// alphabetical (All is prepended for the tab row): Cardio, Climbing, Hangboard,
// Rehab, Strength.
const GROUP_ORDER: ExerciseCategory[] = ['cardio', 'climbing', 'hangboard', 'rehab', 'strength']
const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  hangboard: 'Hangboard',
  climbing: 'Climbing',
  rehab: 'Rehab',
  cardio: 'Cardio',
}
type CatFilter = 'all' | ExerciseCategory

export function ExercisePicker({
  open,
  onOpenChange,
  multiple = false,
  categories,
  onSelect,
}: Props) {
  const exercises = useLiveQuery(() => getAllExercises(), [])
  const defaultCategory = categories?.[0] ?? 'strength'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([]) // ids, in selection order
  const [creating, setCreating] = useState(false) // the full create form (ExerciseFormSheet)
  const [catFilter, setCatFilter] = useState<CatFilter>('all') // universal mode (A66)
  const [favOnly, setFavOnly] = useState(false)

  // A87 — the category filter tabs are ALWAYS shown, in every context the picker
  // opens (new workout, template edit, active session). The `categories` prop just
  // restricts which categories appear (in the tabs and the list).
  const availableCategories = categories ?? GROUP_ORDER
  const tabCats = GROUP_ORDER.filter((c) => availableCategories.includes(c))
  const tabs: { value: CatFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...tabCats.map((c) => ({ value: c as CatFilter, label: CATEGORY_LABEL[c] })),
  ]

  function reset() {
    setQuery('')
    setSelected([])
    setCreating(false)
    setCatFilter('all')
    setFavOnly(false)
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

  // F51 — creating a new exercise uses the same full editor as the Library
  // (ExerciseFormSheet), so the two flows are identical. Once saved, add it to the
  // selection (multi) or finish with it (single).
  async function handleCreated(id: string) {
    setCreating(false)
    const ex = (await getAllExercises()).find((e) => e.id === id)
    if (!ex) return
    if (multiple) setSelected((s) => (s.includes(id) ? s : [...s, id]))
    else finish([ex])
  }

  const filtered = (exercises ?? []).filter(
    (e) =>
      e.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!favOnly || e.favorite) &&
      (catFilter === 'all' ? availableCategories.includes(e.category) : e.category === catFilter),
  )

  // A row (checkbox in multi-select) for one exercise, with a favourite toggle.
  function renderRow(e: Exercise) {
    const isSelected = selected.includes(e.id)
    return (
      <div key={e.id} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onRow(e)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:bg-accent"
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
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{e.name}</span>
              <DisciplineBadge badge={badgeForCategory(e.category)} className="shrink-0" />
            </span>
            {e.muscleGroups.length > 0 && (
              <span className="block text-xs text-muted-foreground">{e.muscleGroups.join(', ')}</span>
            )}
          </span>
        </button>
        <FavoriteButton
          favorite={!!e.favorite}
          onToggle={() => void setExerciseFavorite(e.id, !e.favorite)}
          label={e.name}
        />
      </div>
    )
  }

  return (
    <>
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
          <SheetTitle>Add exercise</SheetTitle>
          <SheetDescription className="sr-only">
            Pick an exercise or create a new one.
          </SheetDescription>
        </SheetHeader>

        <>
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search exercises…"
                  className="flex-1"
                />
                <FavoriteFilterButton active={favOnly} onToggle={() => setFavOnly((v) => !v)} />
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                {tabs.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setCatFilter(t.value)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                      categoryPillClasses(t.value, catFilter === t.value),
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-2">
              {catFilter === 'all' ? (
                // Grouped by category with a sticky header per group (A66).
                tabCats.map((cat) => {
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
              <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add new exercise
              </Button>
            </div>
        </>
      </SheetContent>
    </Sheet>

      {/* F51 — the full Library create form, so creating an exercise here is
          identical to creating one in the Library. */}
      <ExerciseFormSheet
        open={creating}
        onOpenChange={setCreating}
        exercise={null}
        defaultCategory={catFilter !== 'all' ? catFilter : defaultCategory}
        defaultName={query}
        onSaved={handleCreated}
      />
    </>
  )
}

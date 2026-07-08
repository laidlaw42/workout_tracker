import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useTagColours } from '@/hooks/useTagColours'
import { getAllTemplates, getTemplatesInCategory, setTemplateFavorite } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import { FavoriteFilterButton } from '@/components/FavoriteButton'
import { TemplateCard } from '@/components/TemplateCard'
import { ExerciseLibrary } from '@/components/ExerciseLibrary'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { TemplateCategory } from '@/types'

// A94/F46 — templates carry a `categories` array; each tab shows every template
// whose categories include it, so a multi-discipline template appears under each.
type Filter = 'all' | TemplateCategory

// A93/A95 — fixed strictly-alphabetical order, All pinned first (no Mixed tab: a
// multi-category template shows under each of its disciplines). Hardcoded.
const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'strength', label: 'Strength' },
]

export default function LibraryScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('type')
  const [filter, setFilter] = useState<Filter>(() => {
    // A92 — hangboard templates now live under the Climbing tab. A95 — Mixed is no
    // longer a tab, so a legacy ?type=mixed link falls back to All.
    if (initial === 'hangboard') return 'climbing'
    return initial === 'strength' ||
      initial === 'cardio' ||
      initial === 'climbing' ||
      initial === 'rehab'
      ? initial
      : 'all'
  })
  const [view, setView] = useState<'workouts' | 'exercises'>('workouts')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)

  const templates = useLiveQuery(
    () => (filter === 'all' ? getAllTemplates() : getTemplatesInCategory(filter)),
    [filter],
  )
  const tagColour = useTagColours()

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates ?? []) for (const tag of t.tags) set.add(tag)
    return [...set].sort()
  }, [templates])
  const filteredTemplates = templates?.filter(
    (t) => (!activeTag || t.tags.includes(activeTag)) && (!favOnly || t.favorite),
  )

  return (
    <div className="space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-2xl font-bold">Library</h1>

      <SegmentedControl
        options={[
          { value: 'workouts', label: 'Workouts' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'exercises' ? (
        <ExerciseLibrary />
      ) : (
        <>
          {/* A80 — same add affordance as the Exercises tab's "Add new exercise".
              A81 — goes straight to the in-memory creation view (no dialog). */}
          <Button variant="outline" className="w-full" onClick={() => navigate('/library/new')}>
            <Plus className="size-4" /> Add new workout
          </Button>

          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SegmentedControl
                scrollable
                options={OPTIONS}
                value={filter}
                onChange={(v) => {
                  setFilter(v)
                  setActiveTag(null)
                }}
              />
            </div>
            <FavoriteFilterButton active={favOnly} onToggle={() => setFavOnly((v) => !v)} />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    activeTag === tag
                      ? 'bg-primary text-primary-foreground ring-primary'
                      : 'bg-muted text-muted-foreground ring-transparent',
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: tagColour(tag) }} />
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {filteredTemplates === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="No workouts here"
              subtitle={
                favOnly
                  ? 'No favourites here yet — tap the heart on a workout to add one.'
                  : activeTag
                    ? `No workouts tagged #${activeTag}.`
                    : filter === 'climbing'
                      ? 'No climbing workouts yet.'
                      : filter === 'rehab'
                        ? 'No rehab workouts yet.'
                        : 'Tap “Add new workout” to create one.'
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onOpen={() => navigate(`/library/${t.id}`)}
                  onToggleFavorite={() => void setTemplateFavorite(t.id, !t.favorite)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

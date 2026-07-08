import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import { Dumbbell, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useTagColours } from '@/hooks/useTagColours'
import { getAllTemplates, setTemplateFavorite } from '@/db/helpers'
import { isHangboardOnlyTemplate, templateCategories } from '@/lib/templateCategories'
import { SegmentedControl } from '@/components/SegmentedControl'
import { categoryTabClasses } from '@/lib/badges'
import { FavoriteFilterButton } from '@/components/FavoriteButton'
import { TemplateCard } from '@/components/TemplateCard'
import { ExerciseLibrary } from '@/components/ExerciseLibrary'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { TemplateCategory, WorkoutTemplate } from '@/types'

// Templates carry a `categories` array (A94/F46). 'hangboard' isn't a stored
// category — a hangboard workout is filed under 'climbing' with hangboardSets —
// so it's matched by content to mirror the Exercises tab's Hangboard filter.
type Filter = 'all' | TemplateCategory | 'hangboard'

// A93 alphabetical order, All pinned first; matches the Exercises category tabs
// (incl. Hangboard). A multi-category template shows under each of its disciplines.
const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'strength', label: 'Strength' },
]

// Hangboard-only workouts get their own tab, so the Climbing tab shows route /
// climbing-training / mixed workouts — disjoint, mirroring the Exercises tabs.
function matchesFilter(t: WorkoutTemplate, f: Filter): boolean {
  if (f === 'all') return true
  if (f === 'hangboard') return isHangboardOnlyTemplate(t)
  if (f === 'climbing') return templateCategories(t).includes('climbing') && !isHangboardOnlyTemplate(t)
  return templateCategories(t).includes(f)
}

// Remembers the Library's filter / tab / scroll across navigation, so tapping into
// a workout and pressing back restores what you were looking at instead of resetting
// to All + top. Module-level: survives unmount within the SPA session (a full reload
// clears it). Scroll is only restored on a back navigation (POP), not a fresh visit.
const libState = {
  view: 'workouts' as 'workouts' | 'exercises',
  filter: 'all' as Filter,
  activeTag: null as string | null,
  favOnly: false,
  scrollY: 0,
}

export default function LibraryScreen() {
  const navigate = useNavigate()
  const navType = useNavigationType() // 'POP' on a back/forward navigation
  const [params] = useSearchParams()
  const initial = params.get('type')
  // A quick-start link (?type=…, always a fresh PUSH) sets the filter + Workouts
  // tab; otherwise restore the remembered filter/tab (e.g. returning from a
  // workout). A95 — a legacy ?type=mixed falls back to All.
  const fromParam =
    initial === 'strength' ||
    initial === 'cardio' ||
    initial === 'climbing' ||
    initial === 'hangboard' ||
    initial === 'rehab'
      ? (initial as Filter)
      : null
  const [filter, setFilter] = useState<Filter>(() => fromParam ?? libState.filter)
  const [view, setView] = useState<'workouts' | 'exercises'>(() =>
    fromParam ? 'workouts' : libState.view,
  )
  const [activeTag, setActiveTag] = useState<string | null>(() => libState.activeTag)
  const [favOnly, setFavOnly] = useState(() => libState.favOnly)

  // Remember the UI state so a later back navigation restores it.
  useEffect(() => {
    libState.view = view
    libState.filter = filter
    libState.activeTag = activeTag
    libState.favOnly = favOnly
  }, [view, filter, activeTag, favOnly])
  // Save the scroll position when leaving the screen (tapping into a workout).
  useEffect(() => () => void (libState.scrollY = window.scrollY), [])

  const allTemplates = useLiveQuery(() => getAllTemplates(), [])
  const tagColour = useTagColours()

  // Category slice first (client-side, so the computed Hangboard filter works);
  // the tag pills only show tags present in this slice.
  const inCategory = useMemo(
    () => (allTemplates ?? []).filter((t) => matchesFilter(t, filter)),
    [allTemplates, filter],
  )
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of inCategory) for (const tag of t.tags) set.add(tag)
    return [...set].sort()
  }, [inCategory])
  const filteredTemplates =
    allTemplates === undefined
      ? undefined
      : inCategory.filter(
          (t) => (!activeTag || t.tags.includes(activeTag)) && (!favOnly || t.favorite),
        )

  // Restore the scroll position on a back navigation, once the list has data so
  // the page is tall enough for the offset to land (a fresh visit stays at top).
  const restoredRef = useRef(false)
  useLayoutEffect(() => {
    if (restoredRef.current || navType !== 'POP') return
    if (view === 'workouts' && filteredTemplates === undefined) return
    restoredRef.current = true
    if (libState.scrollY > 0) window.scrollTo(0, libState.scrollY)
  }, [navType, view, filteredTemplates])

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
                tone={categoryTabClasses}
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
                      : filter === 'hangboard'
                        ? 'No hangboard workouts yet.'
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

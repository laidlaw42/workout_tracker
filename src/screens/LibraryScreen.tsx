import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useTagColours } from '@/hooks/useTagColours'
import { getHangboardTemplates, getRehabTemplates, getTemplatesByType } from '@/db/helpers'
import { CLIMB_WORKOUT_BADGE, HANGBOARD_BADGE, REHAB_BADGE } from '@/lib/badges'
import { SegmentedControl } from '@/components/SegmentedControl'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { TemplateCard } from '@/components/TemplateCard'
import { ExerciseLibrary } from '@/components/ExerciseLibrary'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DisciplineType } from '@/types'

// Content-based filters (A73/A74): rehab and hangboard aren't template `type`s —
// they filter by the categories of the exercises / hang rows a template contains.
type Filter = 'all' | DisciplineType | 'rehab' | 'hangboard'

// A79 — fixed category order everywhere: All, Strength, Cardio, Hangboard,
// Climbing, Rehab. Never reordered by content/alphabet.
const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
]

export default function LibraryScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('type')
  const [filter, setFilter] = useState<Filter>(
    initial === 'strength' ||
      initial === 'cardio' ||
      initial === 'climbing' ||
      initial === 'rehab' ||
      initial === 'hangboard'
      ? initial
      : 'all',
  )
  const [view, setView] = useState<'workouts' | 'exercises'>('workouts')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const templates = useLiveQuery(
    () =>
      filter === 'rehab'
        ? getRehabTemplates()
        : filter === 'hangboard'
          ? getHangboardTemplates()
          : getTemplatesByType(filter === 'all' ? undefined : filter),
    [filter],
  )
  const tagColour = useTagColours()

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates ?? []) for (const tag of t.tags) set.add(tag)
    return [...set].sort()
  }, [templates])
  const filteredTemplates =
    activeTag && templates ? templates.filter((t) => t.tags.includes(activeTag)) : templates

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
          {/* A80 — same add affordance as the Exercises tab's "Add exercise".
              A81 — goes straight to the in-memory creation view (no dialog). */}
          <Button variant="outline" className="w-full" onClick={() => navigate('/library/new')}>
            <Plus className="size-4" /> New workout
          </Button>

          <SegmentedControl
            options={OPTIONS}
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setActiveTag(null)
            }}
          />

          {filter === 'climbing' && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <DisciplineBadge badge={CLIMB_WORKOUT_BADGE} />
              <span>Start Gym, Crag or Board sessions from the Home screen.</span>
            </div>
          )}

          {filter === 'rehab' && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <DisciplineBadge badge={REHAB_BADGE} />
              <span>Workouts that include rehab exercises.</span>
            </div>
          )}

          {filter === 'hangboard' && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <DisciplineBadge badge={HANGBOARD_BADGE} />
              <span>Training workouts with hangboard exercises.</span>
            </div>
          )}

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
                activeTag
                  ? `No workouts tagged #${activeTag}.`
                  : filter === 'climbing'
                    ? 'Start Gym, Crag or Board sessions from the Home screen.'
                    : filter === 'hangboard'
                      ? 'Log a session with hangboard exercises, then save it as a template.'
                      : 'Tap “New workout” to create one.'
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onOpen={() => navigate(`/library/${t.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

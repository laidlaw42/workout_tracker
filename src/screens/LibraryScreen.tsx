import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Dumbbell, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteTemplate, getTemplatesByType, upsertTemplate } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TemplateCard } from '@/components/TemplateCard'
import { ExerciseLibrary } from '@/components/ExerciseLibrary'
import { ClimbingQuickStarts } from '@/components/ClimbingQuickStarts'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DisciplineType, WorkoutTemplate } from '@/types'

type Filter = 'all' | DisciplineType
type NewKind = 'strength' | 'cardio' | 'hangboard' | 'workout'

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
]

export default function LibraryScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('type')
  const [filter, setFilter] = useState<Filter>(
    initial === 'strength' || initial === 'cardio' || initial === 'climbing' ? initial : 'all',
  )
  const [view, setView] = useState<'workouts' | 'exercises'>('workouts')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<WorkoutTemplate | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<NewKind>('strength')

  const templates = useLiveQuery(
    () => getTemplatesByType(filter === 'all' ? undefined : filter),
    [filter],
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates ?? []) for (const tag of t.tags) set.add(tag)
    return [...set].sort()
  }, [templates])
  const filteredTemplates =
    activeTag && templates ? templates.filter((t) => t.tags.includes(activeTag)) : templates

  async function createTemplate() {
    const name = newName.trim() || 'New workout'
    const draft =
      newType === 'strength'
        ? { name, type: 'strength' as const, tags: [], exercises: [] }
        : newType === 'cardio'
          ? { name, type: 'cardio' as const, tags: [], exercises: [], cardioActivity: 'run' as const }
          : {
              name,
              type: 'climbing' as const,
              tags: [],
              exercises: [],
              climbingKind: newType === 'hangboard' ? ('hangboard' as const) : ('workout' as const),
              hangboardSets: [],
            }
    try {
      const id = await upsertTemplate(draft)
      setNewOpen(false)
      setNewName('')
      navigate(`/library/${id}/edit`)
    } catch {
      toast.error('Could not create template')
    }
  }

  const climbingCreate = newType === 'hangboard' || newType === 'workout'
  const newTypeOptions: { value: NewKind; label: string }[] = climbingCreate
    ? [
        { value: 'hangboard', label: 'Hangboard' },
        { value: 'workout', label: 'Climbing workout' },
      ]
    : [
        { value: 'strength', label: 'Strength' },
        { value: 'cardio', label: 'Cardio' },
      ]

  function openNew() {
    setNewName('')
    setNewType(filter === 'climbing' ? 'hangboard' : 'strength')
    setNewOpen(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await deleteTemplate(toDelete.id)
      toast.success(`Deleted "${toDelete.name}"`)
    } catch {
      toast.error('Could not delete template')
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Library</h1>
        {view === 'workouts' && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> New
          </Button>
        )}
      </div>

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
          <SegmentedControl
            options={OPTIONS}
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setActiveTag(null)
            }}
          />

          {filter === 'climbing' && <ClimbingQuickStarts />}

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    activeTag === tag
                      ? 'bg-primary text-primary-foreground ring-primary'
                      : 'bg-muted text-muted-foreground ring-transparent',
                  )}
                >
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
              subtitle={activeTag ? `No workouts tagged #${activeTag}.` : 'Tap New to create a workout routine.'}
            />
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onOpen={() => navigate(`/library/${t.id}`)}
                  onDelete={() => setToDelete(t)}
                />
              ))}
            </div>
          )}

          <p className="px-1 text-center text-xs text-muted-foreground">
            Tip: press and hold a workout to delete it.
          </p>
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{climbingCreate ? 'New climbing workout' : 'New workout'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newName}
                placeholder="e.g. Upper B"
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <SegmentedControl options={newTypeOptions} value={newType} onChange={setNewType} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template. Logged workouts from it are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

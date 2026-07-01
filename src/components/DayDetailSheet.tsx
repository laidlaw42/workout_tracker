import { CheckCircle2, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { DISCIPLINE_BADGE, DISCIPLINE_DOT, DISCIPLINE_LABEL } from '@/lib/discipline'
import { formatTimeOfDay, fromDateKey, fullDayLabel } from '@/lib/date'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { PlannedWorkout, WorkoutSession } from '@/types'

interface Props {
  dateKey: string | null
  onOpenChange: (open: boolean) => void
  planned: PlannedWorkout[]
  sessions: WorkoutSession[]
  onAdd: () => void
  onEditPlan: (plan: PlannedWorkout) => void
  onDeletePlan: (plan: PlannedWorkout) => void
  onOpenSession: (sessionId: string) => void
}

export function DayDetailSheet({
  dateKey,
  onOpenChange,
  planned,
  sessions,
  onAdd,
  onEditPlan,
  onDeletePlan,
  onOpenSession,
}: Props) {
  return (
    <Sheet open={dateKey !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{dateKey ? fullDayLabel(dateKey) : ''}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <section className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Planned</p>
            {planned.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing planned yet.</p>
            ) : (
              <ul className="space-y-2">
                {planned.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span className={cn('size-2.5 shrink-0 rounded-full', DISCIPLINE_DOT[p.disciplineType])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.templateName}
                        {p.completedSessionId && (
                          <CheckCircle2 className="ml-1.5 inline size-4 text-green-500" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span
                          className={cn('rounded px-1.5 py-0.5', DISCIPLINE_BADGE[p.disciplineType])}
                        >
                          {DISCIPLINE_LABEL[p.disciplineType]}
                        </span>
                        {p.plannedTimeOfDay != null && (
                          <span className="ml-2">{formatTimeOfDay(p.plannedTimeOfDay)}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Edit plan"
                      onClick={() => onEditPlan(p)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete plan"
                      onClick={() => onDeletePlan(p)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-destructive active:bg-accent"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="w-full" onClick={onAdd}>
              <Plus className="size-4" /> Add to this day
            </Button>
          </section>

          {sessions.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSession(s.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left active:bg-accent"
                    >
                      <span className={cn('size-2.5 shrink-0 rounded-full', DISCIPLINE_DOT[s.type])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.templateName}</p>
                        <p className="text-xs text-muted-foreground">
                          {DISCIPLINE_LABEL[s.type]} ·{' '}
                          {fromDateKey(dateKey ?? '').getTime()
                            ? new Date(s.startedAt).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : ''}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

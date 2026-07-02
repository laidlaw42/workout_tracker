import { useState } from 'react'
import { ArrowLeftRight, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SetCountdown } from '@/components/SetCountdown'
import type { LoggedSet } from '@/types'

export interface WorkExercise {
  uid: string
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps?: number
  durationSeconds?: number // timed exercise (e.g. plank) — logs by holding, not reps
  restSeconds: number
  swappedFrom?: string
  skipped: boolean
}

export interface LoggedSetInput {
  weightKg?: number
  actualReps?: number
  durationSeconds?: number
}

interface Props {
  exercise: WorkExercise
  loggedSets: LoggedSet[]
  isCurrent: boolean
  prefillWeight?: number
  onLog: (data: LoggedSetInput) => void
  onAddSet: () => void
  /** Inline swap is offered on the current exercise only. */
  onSwap?: () => void
  /** Timed exercises: start the set countdown (session logs it at zero). */
  onStartCountdown?: () => void
  countdown?: { remaining: number; duration: number } | null
}

// The body of an exercise card. The card shell (border, drag handle, long-press
// Skip/Remove menu) is provided by SortableList.
export function ExerciseCard({
  exercise,
  loggedSets,
  isCurrent,
  prefillWeight,
  onLog,
  onAddSet,
  onSwap,
  onStartCountdown,
  countdown,
}: Props) {
  const doneCount = loggedSets.length
  const complete = doneCount >= exercise.targetSets
  const currentSetNumber = doneCount + 1
  const timed = exercise.durationSeconds != null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{exercise.exerciseName}</p>
          {exercise.swappedFrom && (
            <p className="text-xs text-muted-foreground">swapped from {exercise.swappedFrom}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {exercise.skipped
              ? 'Skipped'
              : complete
                ? 'Done'
                : `Set ${currentSetNumber} of ${exercise.targetSets}`}
          </span>
          {isCurrent && onSwap && (
            <button
              type="button"
              aria-label="Swap exercise"
              onClick={onSwap}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent"
            >
              <ArrowLeftRight className="size-4" />
            </button>
          )}
        </div>
      </div>

      {!exercise.skipped && (
        <div className="space-y-2">
          {loggedSets.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300"
            >
              <Check className="size-4 shrink-0" />
              <span className="w-10 text-muted-foreground">Set {s.setNumber}</span>
              <span className="font-medium text-foreground">
                {s.durationSeconds != null
                  ? `${s.durationSeconds}s`
                  : `${s.weightKg != null ? `${s.weightKg} kg` : 'BW'} × ${s.actualReps ?? '—'}`}
              </span>
            </div>
          ))}

          {isCurrent &&
            !complete &&
            (timed ? (
              countdown ? (
                <SetCountdown remaining={countdown.remaining} duration={countdown.duration} label="Hold" />
              ) : (
                <Button className="w-full" onClick={onStartCountdown}>
                  Start {exercise.durationSeconds}s hold
                </Button>
              )
            ) : (
              <SetRow
                key={currentSetNumber}
                setNumber={currentSetNumber}
                targetReps={exercise.targetReps}
                prefillWeight={prefillWeight}
                onLog={onLog}
              />
            ))}

          <button
            type="button"
            onClick={onAddSet}
            className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors active:bg-accent"
          >
            <Plus className="size-3.5" /> Add set
          </button>
        </div>
      )}
    </div>
  )
}

interface SetRowProps {
  setNumber: number
  targetReps?: number
  prefillWeight?: number
  onLog: (data: LoggedSetInput) => void
}

function SetRow({ setNumber, targetReps, prefillWeight, onLog }: SetRowProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState(targetReps != null ? String(targetReps) : '')

  function log() {
    const w = weight.trim() === '' ? undefined : Number(weight)
    const r = reps.trim() === '' ? undefined : Number(reps)
    onLog({
      weightKg: w != null && !Number.isNaN(w) ? w : undefined,
      actualReps: r != null && !Number.isNaN(r) ? r : undefined,
    })
    setWeight('')
    setReps(targetReps != null ? String(targetReps) : '')
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-primary/40 bg-background p-2">
      <span className="pb-2.5 text-sm text-muted-foreground">Set {setNumber}</span>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Weight (kg)</span>
        <Input
          inputMode="decimal"
          value={weight}
          placeholder={prefillWeight != null ? String(prefillWeight) : 'BW'}
          onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
          className="h-10"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Reps</span>
        <Input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ''))}
          className="h-10"
        />
      </label>
      <Button className="h-10" onClick={log} disabled={reps.trim() === ''}>
        Log
      </Button>
    </div>
  )
}

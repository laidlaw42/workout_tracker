import { useState } from 'react'
import { ArrowLeftRight, Check, Minus, Plus } from 'lucide-react'
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
  additionalWeightKg?: number
  actualReps?: number
  durationSeconds?: number
}

interface Props {
  exercise: WorkExercise
  loggedSets: LoggedSet[]
  isCurrent: boolean
  prefillWeight?: number
  /** Bodyweight movement that can carry extra load — shows the +kg field. */
  supportsAdditionalWeight?: boolean
  onLog: (data: LoggedSetInput) => void
  onAddSet: () => void
  /** Remove the current incomplete set (last set → confirms exercise removal). */
  onRemoveSet?: () => void
  /** Inline swap is offered on the current exercise only. */
  onSwap?: () => void
  /** Timed exercises: start the set countdown (session logs it at zero). */
  onStartCountdown?: () => void
  countdown?: { remaining: number; duration: number; precount?: boolean } | null
}

// The body of an exercise card. The card shell (border, drag handle, long-press
// Skip/Remove menu) is provided by SortableList.
export function ExerciseCard({
  exercise,
  loggedSets,
  isCurrent,
  prefillWeight,
  supportsAdditionalWeight,
  onLog,
  onAddSet,
  onRemoveSet,
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
                  : `${
                      s.additionalWeightKg
                        ? `BW +${s.additionalWeightKg} kg`
                        : s.weightKg != null
                          ? `${s.weightKg} kg`
                          : 'BW'
                    } × ${s.actualReps ?? '—'}`}
              </span>
            </div>
          ))}

          {isCurrent &&
            !complete &&
            (timed ? (
              countdown ? (
                <SetCountdown
                  remaining={countdown.remaining}
                  duration={countdown.duration}
                  label={countdown.precount ? 'Get ready' : 'Hold'}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Button className="flex-1" onClick={onStartCountdown}>
                    Start {exercise.durationSeconds}s hold
                  </Button>
                  {onRemoveSet && (
                    <button
                      type="button"
                      aria-label="Remove set"
                      onClick={onRemoveSet}
                      className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors active:bg-accent"
                    >
                      <Minus className="size-4" />
                    </button>
                  )}
                </div>
              )
            ) : (
              <SetRow
                key={currentSetNumber}
                targetReps={exercise.targetReps}
                prefillWeight={prefillWeight}
                supportsAdditionalWeight={supportsAdditionalWeight}
                onLog={onLog}
                onRemove={onRemoveSet}
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
  targetReps?: number
  prefillWeight?: number
  supportsAdditionalWeight?: boolean
  onLog: (data: LoggedSetInput) => void
  onRemove?: () => void
}

function SetRow({ targetReps, prefillWeight, supportsAdditionalWeight, onLog, onRemove }: SetRowProps) {
  const [weight, setWeight] = useState('')
  const [addl, setAddl] = useState('')
  const [reps, setReps] = useState(targetReps != null ? String(targetReps) : '')

  function log() {
    const w = weight.trim() === '' ? undefined : Number(weight)
    const a = addl.trim() === '' ? undefined : Number(addl)
    const r = reps.trim() === '' ? undefined : Number(reps)
    onLog({
      weightKg: w != null && !Number.isNaN(w) ? w : undefined,
      additionalWeightKg: a != null && !Number.isNaN(a) && a > 0 ? a : undefined,
      actualReps: r != null && !Number.isNaN(r) ? r : undefined,
    })
    setWeight('')
    setAddl('')
    setReps(targetReps != null ? String(targetReps) : '')
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-primary/40 bg-background p-2">
      {onRemove && (
        <button
          type="button"
          aria-label="Remove set"
          onClick={onRemove}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors active:bg-accent"
        >
          <Minus className="size-4" />
        </button>
      )}
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
      {supportsAdditionalWeight && (
        <label className="flex w-16 flex-col gap-1">
          <span className="text-xs text-muted-foreground">+kg</span>
          <Input
            inputMode="decimal"
            value={addl}
            placeholder="0"
            onChange={(e) => setAddl(e.target.value.replace(/[^0-9.]/g, ''))}
            className="h-10"
          />
        </label>
      )}
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

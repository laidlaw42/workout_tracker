import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Check, Minus, Pencil, Plus } from 'lucide-react'
import { getBodyweight } from '@/lib/bodyweight'
import { getWeightStep } from '@/lib/prefs'
import { Button } from '@/components/ui/button'
import { NumberStepper } from '@/components/NumberStepper'
import { SetCountdown } from '@/components/SetCountdown'
import type { LoggedSet } from '@/types'

export interface WorkExercise {
  uid: string
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps?: number
  durationSeconds?: number // timed exercise (e.g. plank) — logs by holding, not reps
  weight?: number // planned weight (kg) for remaining sets — pre-fills the set row (A31)
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

// Fields editable inline mid-session (A31) — applied to remaining unlogged sets.
export type ExerciseEdit = Partial<
  Pick<WorkExercise, 'targetReps' | 'durationSeconds' | 'weight' | 'restSeconds'>
>

interface Props {
  exercise: WorkExercise
  loggedSets: LoggedSet[]
  isCurrent: boolean
  /** Last logged set for this exercise (any session) — pre-fills the row (F22). */
  prefill?: Pick<LoggedSet, 'weightKg' | 'additionalWeightKg' | 'actualReps'>
  /** Bodyweight movement that can carry extra load — shows the +kg field. */
  supportsAdditionalWeight?: boolean
  onLog: (data: LoggedSetInput) => void
  onAddSet: () => void
  /** Remove the current incomplete set (last set → confirms exercise removal). */
  onRemoveSet?: () => void
  /** Inline swap is offered on the current exercise only. */
  onSwap?: () => void
  /** Edit target reps/duration, weight, rest for the remaining sets (A31). */
  onEdit?: (updates: ExerciseEdit) => void
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
  prefill,
  supportsAdditionalWeight,
  onLog,
  onAddSet,
  onRemoveSet,
  onSwap,
  onEdit,
  onStartCountdown,
  countdown,
}: Props) {
  const [editing, setEditing] = useState(false)
  const doneCount = loggedSets.length
  const complete = doneCount >= exercise.targetSets
  const currentSetNumber = doneCount + 1
  const timed = exercise.durationSeconds != null
  const canEdit = onEdit != null && !exercise.skipped && !complete

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{exercise.exerciseName}</p>
          {exercise.swappedFrom && (
            <p className="text-xs text-muted-foreground">swapped from {exercise.swappedFrom}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-base text-muted-foreground">
            {exercise.skipped ? (
              'Skipped'
            ) : complete ? (
              'Done'
            ) : (
              <>
                Set <span className="font-bold text-foreground">{currentSetNumber}</span> of{' '}
                {exercise.targetSets}
              </>
            )}
          </span>
          {canEdit && (
            <button
              type="button"
              aria-label="Edit exercise"
              aria-pressed={editing}
              onClick={() => setEditing((e) => !e)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
          )}
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

      {editing && canEdit && (
        <EditPanel exercise={exercise} onEdit={onEdit!} />
      )}

      {!exercise.skipped && (
        <div className="space-y-2">
          {loggedSets.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300"
            >
              <Check className="size-4 shrink-0" />
              <span className="w-12 text-muted-foreground">Set {s.setNumber}</span>
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
              // Key on the set number + editable targets so advancing a set and
              // an inline A31 edit both re-seed. The async last-set prefill is
              // NOT in the key — it's synced in via an effect so it never wipes
              // input the user has already typed (F22).
              <SetRow
                key={`${currentSetNumber}-${exercise.targetReps ?? ''}-${exercise.weight ?? ''}`}
                targetReps={exercise.targetReps}
                plannedWeight={exercise.weight}
                prefill={prefill}
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

// Inline editor for the remaining sets' targets (A31). Each stepper writes back
// immediately, so changes take effect on the next unlogged set.
function EditPanel({ exercise, onEdit }: { exercise: WorkExercise; onEdit: (u: ExerciseEdit) => void }) {
  const timed = exercise.durationSeconds != null
  const [reps, setReps] = useState(exercise.targetReps != null ? String(exercise.targetReps) : '')
  const [duration, setDuration] = useState(
    exercise.durationSeconds != null ? String(exercise.durationSeconds) : '',
  )
  const [weight, setWeight] = useState(exercise.weight != null ? String(exercise.weight) : '')
  const [rest, setRest] = useState(String(exercise.restSeconds))

  const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v))

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background p-3">
      {timed ? (
        <EditField label="Duration (s)">
          <NumberStepper
            value={duration}
            ariaLabel="duration"
            min={1}
            onChange={(v) => {
              setDuration(v)
              onEdit({ durationSeconds: toNum(v) })
            }}
          />
        </EditField>
      ) : (
        <>
          <EditField label="Reps">
            <NumberStepper
              value={reps}
              ariaLabel="target reps"
              min={0}
              onChange={(v) => {
                setReps(v)
                onEdit({ targetReps: toNum(v) })
              }}
            />
          </EditField>
          <EditField label="Weight (kg)">
            <NumberStepper
              value={weight}
              ariaLabel="weight"
              step={getWeightStep()}
              min={0}
              inputMode="decimal"
              onChange={(v) => {
                setWeight(v)
                onEdit({ weight: toNum(v) })
              }}
            />
          </EditField>
        </>
      )}
      <EditField label="Rest (s)">
        <NumberStepper
          value={rest}
          ariaLabel="rest"
          step={5}
          min={0}
          onChange={(v) => {
            setRest(v)
            onEdit({ restSeconds: toNum(v) ?? 0 })
          }}
        />
      </EditField>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface SetRowProps {
  targetReps?: number
  plannedWeight?: number
  prefill?: Pick<LoggedSet, 'weightKg' | 'additionalWeightKg' | 'actualReps'>
  supportsAdditionalWeight?: boolean
  onLog: (data: LoggedSetInput) => void
  onRemove?: () => void
}

// Pre-fill precedence (F22): an inline A31 edit (plannedWeight / targetReps) wins;
// otherwise the last logged set's values fill in, so an unchanged set logs in one
// tap. `str` renders a number as an input value, blank for null/undefined.
const str = (n?: number) => (n != null ? String(n) : '')

function SetRow({
  targetReps,
  plannedWeight,
  prefill,
  supportsAdditionalWeight,
  onLog,
  onRemove,
}: SetRowProps) {
  const seedWeight = () => str(plannedWeight ?? prefill?.weightKg)
  const seedAddl = () => str(prefill?.additionalWeightKg)
  const seedReps = () => str(targetReps ?? prefill?.actualReps)
  const [weight, setWeight] = useState(seedWeight)
  const [addl, setAddl] = useState(seedAddl)
  const [reps, setReps] = useState(seedReps)
  // F39 — advisory warning when logging a weighted set with an empty weight.
  const [warnWeight, setWarnWeight] = useState(false)
  const weightRef = useRef<HTMLInputElement>(null)
  const weightStep = getWeightStep() // A60 — configurable +/− step

  // Weight is a relevant, expected field only for plain weighted exercises: a
  // bodyweight-loadable move (pull-up, dip) leaves the primary weight blank by
  // design, and timed exercises never reach SetRow. So the warning is gated to
  // exercises without a dedicated additional-weight field.
  const weightExpected = !supportsAdditionalWeight
  const showWeightWarning = warnWeight && weightExpected && weight.trim() === ''

  // The last-set prefill resolves asynchronously (and briefly holds the previous
  // exercise's value across an exercise change). Adopt it once it arrives, but
  // only while the user hasn't typed anything yet, so it never clobbers input.
  const dirty = useRef(false)
  const markDirty = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true
    set(v)
  }
  useEffect(() => {
    if (dirty.current) return
    setWeight(seedWeight())
    setAddl(seedAddl())
    setReps(seedReps())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.weightKg, prefill?.additionalWeightKg, prefill?.actualReps])

  // Effort as a % of bodyweight (A39), if a bodyweight is set. The bar weight is
  // shown relative to bodyweight; for a bodyweight+load move the % is the total
  // (bodyweight + added load) relative to bodyweight. Recomputed each render, so
  // it tracks the +/- steppers and typing live.
  const bw = getBodyweight()
  const wNum = weight.trim() === '' ? null : Number(weight)
  const aNum = addl.trim() === '' ? null : Number(addl)
  const weightPct = bw != null && wNum != null && Number.isFinite(wNum) && wNum > 0 ? Math.round((wNum / bw) * 100) : null
  const addlPct = bw != null && aNum != null && Number.isFinite(aNum) && aNum > 0 ? Math.round(((bw + aNum) / bw) * 100) : null

  function doLog() {
    setWarnWeight(false)
    const w = weight.trim() === '' ? undefined : Number(weight)
    const a = addl.trim() === '' ? undefined : Number(addl)
    const r = reps.trim() === '' ? undefined : Number(reps)
    onLog({
      weightKg: w != null && !Number.isNaN(w) ? w : undefined,
      additionalWeightKg: a != null && !Number.isNaN(a) && a > 0 ? a : undefined,
      actualReps: r != null && !Number.isNaN(r) ? r : undefined,
    })
    setWeight(seedWeight())
    setAddl(seedAddl())
    setReps(seedReps())
  }

  // Logging is never blocked — an empty weight only surfaces an advisory warning
  // first (F39). Some exercises are legitimately done unloaded, so a second tap
  // ("Log anyway") proceeds with weightKg undefined.
  function attemptLog() {
    if (weightExpected && weight.trim() === '') {
      setWarnWeight(true)
      return
    }
    doLog()
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-background p-3">
      <SetField label="Weight (kg)">
        <NumberStepper
          value={weight}
          ariaLabel="weight"
          step={weightStep}
          min={0}
          inputMode="decimal"
          placeholder="BW"
          inputRef={weightRef}
          // Editing the weight dismisses the empty-weight warning (F39) for good,
          // so re-clearing it later doesn't re-surface it without a fresh Log tap.
          onChange={(v) => {
            if (warnWeight) setWarnWeight(false)
            markDirty(setWeight)(v)
          }}
        />
      </SetField>
      {weightPct != null && (
        <p className="-mt-2 pr-1 text-right text-xs text-muted-foreground">
          {weightPct}% of bodyweight
        </p>
      )}
      {showWeightWarning && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <span className="text-amber-300">No weight entered — are you sure?</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={doLog}
              className="rounded-md border border-border px-2 py-1 font-medium text-foreground transition-colors active:bg-accent"
            >
              Log anyway
            </button>
            <button
              type="button"
              onClick={() => {
                setWarnWeight(false)
                weightRef.current?.focus()
              }}
              className="rounded-md border border-border px-2 py-1 font-medium text-foreground transition-colors active:bg-accent"
            >
              Add weight
            </button>
          </div>
        </div>
      )}
      {supportsAdditionalWeight && (
        <SetField label="Additional (kg)">
          <NumberStepper
            value={addl}
            ariaLabel="additional weight"
            step={weightStep}
            min={0}
            inputMode="decimal"
            placeholder="0"
            onChange={markDirty(setAddl)}
          />
        </SetField>
      )}
      {addlPct != null && (
        <p className="-mt-2 pr-1 text-right text-xs text-muted-foreground">
          {addlPct}% of bodyweight
        </p>
      )}
      <SetField label="Reps">
        <NumberStepper value={reps} ariaLabel="reps" min={0} onChange={markDirty(setReps)} />
      </SetField>
      <div className="flex gap-2">
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
        <Button className="h-10 flex-1" onClick={attemptLog} disabled={reps.trim() === ''}>
          Log set
        </Button>
      </div>
    </div>
  )
}

function SetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

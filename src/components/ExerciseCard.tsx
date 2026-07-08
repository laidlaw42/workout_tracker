import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Check, Minus, Pencil, Plus } from 'lucide-react'
import { bodyweightLoadPct, getBodyweight, setWeightLabel } from '@/lib/bodyweight'
import { getWeightStep } from '@/lib/prefs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberStepper } from '@/components/NumberStepper'
import { SetCountdown } from '@/components/SetCountdown'
import type { LoggedSet, WeightLabel } from '@/types'

// F51 — the load input's label follows the exercise's weightLabel; a ± suffix
// signals that assisted (negative) values are allowed.
function loadFieldLabel(weightLabel: WeightLabel | undefined, negative: boolean): string {
  const base =
    weightLabel === 'added_load' ? 'Added load' : weightLabel === 'load' ? 'Load' : 'Weight'
  return `${base}${negative ? ' ±' : ''} (kg)`
}

export interface WorkExercise {
  uid: string
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps?: number
  durationSeconds?: number // timed exercise (e.g. plank) — logs by holding, not reps
  weight?: number // planned weight (kg) for remaining sets — pre-fills the set row (A31)
  distanceKm?: number // planned target distance (km) for a cardio row — pre-fills it (A98)
  restSeconds: number
  // F51 — planned hangboard params for a timed row (edge, and for an intra-rest /
  // Abrahang protocol the reps + intra-rest); pre-fill the row and drive an
  // auto-advanced / resumed set that has no user-entered values.
  edgeDepthMm?: number
  intraRestSeconds?: number
  abrahangReps?: number
  swappedFrom?: string
  skipped: boolean
}

export interface LoggedSetInput {
  weightKg?: number
  additionalWeightKg?: number
  actualReps?: number
  durationSeconds?: number
  distanceKm?: number // cardio exercise in a mixed session (A66)
  // F51 — hangboard fields captured on a timed (hang) set.
  edgeDepthMm?: number
  intraRestSeconds?: number
  abrahangReps?: number
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
  /** F51 — show a weight/load input on the set row. Default true. */
  hasWeight?: boolean
  /** F51 — label for the load input: 'weight' | 'added_load' | 'load'. */
  weightLabel?: WeightLabel
  /** F51 — bodyweight movement: load stores in additionalWeightKg; % is (BW+load)/BW. */
  isBodyweight?: boolean
  /** F51 — allow negative (assisted) load values. */
  supportsNegativeLoad?: boolean
  /** F51 — show an edge-depth (mm) input on a timed (hang) row. */
  hasEdgeDepth?: boolean
  /** F51 — show reps + intra-rest inputs on a timed row (Abrahang/repeater). */
  hasIntraRest?: boolean
  /** Cardio exercise (A66): render the duration + distance row instead of reps. */
  distanceMode?: boolean
  onLog: (data: LoggedSetInput) => void
  onAddSet: () => void
  /** Remove the current incomplete set (last set → confirms exercise removal). */
  onRemoveSet?: () => void
  /** Inline swap is offered on the current exercise only. */
  onSwap?: () => void
  /** Edit target reps/duration, weight, rest for the remaining sets (A31). */
  onEdit?: (updates: ExerciseEdit) => void
  /** Timed exercises: start the set countdown with the captured load/edge/intra-rest. */
  onStartCountdown?: (input: LoggedSetInput) => void
  countdown?: { remaining: number; duration: number; precount?: boolean } | null
}

// The body of an exercise card. The card shell (border, drag handle, long-press
// Skip/Remove menu) is provided by SortableList.
export function ExerciseCard({
  exercise,
  loggedSets,
  isCurrent,
  prefill,
  hasWeight = true,
  weightLabel,
  isBodyweight,
  supportsNegativeLoad,
  hasEdgeDepth,
  hasIntraRest,
  distanceMode = false,
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
  const timed = !distanceMode && exercise.durationSeconds != null
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
        <EditPanel
          exercise={exercise}
          distanceMode={distanceMode}
          hasWeight={hasWeight}
          weightLabel={weightLabel}
          onEdit={onEdit!}
        />
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
                {distanceMode
                  ? `${Math.round((s.durationSeconds ?? 0) / 60)} min${s.distanceKm != null ? ` · ${s.distanceKm} km` : ''}`
                  : s.durationSeconds != null
                    ? `${s.durationSeconds}s${s.additionalWeightKg || s.weightKg != null ? ` · ${setWeightLabel(s)}` : ''}${s.edgeDepthMm != null ? ` · ${s.edgeDepthMm}mm` : ''}`
                    : `${setWeightLabel(s)} × ${s.actualReps ?? '—'}`}
              </span>
            </div>
          ))}

          {isCurrent &&
            !complete &&
            (distanceMode ? (
              // Cardio exercise in a mixed session (A66): duration + distance.
              <CardioSetRow
                key={currentSetNumber}
                defaultDistanceKm={exercise.distanceKm}
                onLog={onLog}
                onRemove={onRemoveSet}
              />
            ) : timed ? (
              countdown ? (
                <SetCountdown
                  remaining={countdown.remaining}
                  duration={countdown.duration}
                  label={countdown.precount ? 'Get ready' : 'Hold'}
                  phase={countdown.precount ? 'precount' : 'hold'}
                />
              ) : (
                <TimedSetRow
                  key={`${currentSetNumber}-${exercise.durationSeconds ?? ''}-${exercise.weight ?? ''}`}
                  exercise={exercise}
                  prefill={prefill}
                  hasWeight={hasWeight}
                  weightLabel={weightLabel}
                  isBodyweight={isBodyweight}
                  supportsNegativeLoad={supportsNegativeLoad}
                  hasEdgeDepth={hasEdgeDepth}
                  hasIntraRest={hasIntraRest}
                  onStart={(input) => onStartCountdown?.(input)}
                  onRemove={onRemoveSet}
                />
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
                hasWeight={hasWeight}
                weightLabel={weightLabel}
                isBodyweight={isBodyweight}
                supportsNegativeLoad={supportsNegativeLoad}
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
function EditPanel({
  exercise,
  distanceMode = false,
  hasWeight = true,
  weightLabel,
  onEdit,
}: {
  exercise: WorkExercise
  distanceMode?: boolean
  hasWeight?: boolean
  weightLabel?: WeightLabel
  onEdit: (u: ExerciseEdit) => void
}) {
  // A cardio exercise's duration/distance are entered per bout, so only Rest is
  // editable here — never a stale "Duration (s)" hold field (A66).
  const timed = !distanceMode && exercise.durationSeconds != null
  const [reps, setReps] = useState(exercise.targetReps != null ? String(exercise.targetReps) : '')
  const [duration, setDuration] = useState(
    exercise.durationSeconds != null ? String(exercise.durationSeconds) : '',
  )
  const [weight, setWeight] = useState(exercise.weight != null ? String(exercise.weight) : '')
  const [rest, setRest] = useState(String(exercise.restSeconds))

  const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v))

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background p-3">
      {distanceMode ? null : timed ? (
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
          {hasWeight && (
            <EditField label={loadFieldLabel(weightLabel, false)}>
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
          )}
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
  hasWeight?: boolean
  weightLabel?: WeightLabel
  isBodyweight?: boolean
  supportsNegativeLoad?: boolean
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
  hasWeight = true,
  weightLabel,
  isBodyweight,
  supportsNegativeLoad,
  onLog,
  onRemove,
}: SetRowProps) {
  // F51 — a single load field. A bodyweight move stores its added/assisted load in
  // additionalWeightKg (so PRs, labels and the % stay bodyweight-relative); every
  // other weighted move stores a plain bar weight in weightKg. Planned (template /
  // A31 edit) wins, else the last logged set's value (F22).
  const seedLoad = () =>
    str(isBodyweight ? (plannedWeight ?? prefill?.additionalWeightKg) : (plannedWeight ?? prefill?.weightKg))
  const seedReps = () => str(targetReps ?? prefill?.actualReps)
  const [load, setLoad] = useState(seedLoad)
  const [reps, setReps] = useState(seedReps)
  // F39 — advisory warning when logging a weighted set with an empty weight.
  const [warnWeight, setWarnWeight] = useState(false)
  const loadRef = useRef<HTMLInputElement>(null)
  const weightStep = getWeightStep() // A60 — configurable +/− step

  // The empty-load warning is for plain weighted moves only: a bodyweight move is
  // legitimately done unloaded (an unweighted pull-up), so it never warns.
  const weightExpected = hasWeight && !isBodyweight
  const showWeightWarning = warnWeight && weightExpected && load.trim() === ''

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
    setLoad(seedLoad())
    setReps(seedReps())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.weightKg, prefill?.additionalWeightKg, prefill?.actualReps])

  // Effort as a % of bodyweight (A39), if a bodyweight is set. A bodyweight move
  // is (bodyweight + load) / bodyweight (so an assisted −20 on a 70 kg climber
  // reads ~71%); a plain weighted move is load / bodyweight. Live per render.
  const bw = getBodyweight()
  const loadNum = load.trim() === '' ? null : Number(load)
  const pct =
    !hasWeight || bw == null || loadNum == null || !Number.isFinite(loadNum)
      ? null
      : isBodyweight
        ? loadNum !== 0
          ? bodyweightLoadPct(loadNum)
          : null
        : loadNum > 0
          ? Math.round((loadNum / bw) * 100)
          : null

  function doLog() {
    setWarnWeight(false)
    const l = load.trim() === '' ? undefined : Number(load)
    const r = reps.trim() === '' ? undefined : Number(reps)
    const validLoad = l != null && !Number.isNaN(l)
    onLog({
      weightKg: validLoad && !isBodyweight ? l : undefined,
      additionalWeightKg: validLoad && isBodyweight && l !== 0 ? l : undefined,
      actualReps: r != null && !Number.isNaN(r) ? r : undefined,
    })
    setLoad(seedLoad())
    setReps(seedReps())
  }

  // Logging is never blocked — an empty weight only surfaces an advisory warning
  // first (F39). Some exercises are legitimately done unloaded, so a second tap
  // ("Log anyway") proceeds with the load undefined.
  function attemptLog() {
    if (weightExpected && load.trim() === '') {
      setWarnWeight(true)
      return
    }
    doLog()
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-background p-3">
      {hasWeight && (
        <SetField label={loadFieldLabel(weightLabel, supportsNegativeLoad ?? false)}>
          <NumberStepper
            value={load}
            ariaLabel="load"
            step={weightStep}
            min={supportsNegativeLoad ? -999 : 0}
            inputMode="decimal"
            placeholder={isBodyweight ? '0' : 'BW'}
            inputRef={loadRef}
            // Editing the load dismisses the empty-weight warning (F39) for good,
            // so re-clearing it later doesn't re-surface it without a fresh Log tap.
            onChange={(v) => {
              if (warnWeight) setWarnWeight(false)
              markDirty(setLoad)(v)
            }}
          />
        </SetField>
      )}
      {pct != null && (
        <p className="-mt-2 pr-1 text-right text-xs text-muted-foreground">{pct}% of bodyweight</p>
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
                loadRef.current?.focus()
              }}
              className="rounded-md border border-border px-2 py-1 font-medium text-foreground transition-colors active:bg-accent"
            >
              Add weight
            </button>
          </div>
        </div>
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

// F51 — the timed (hold / hang) set row. Config-driven like SetRow: a load input
// (bodyweight moves store into additionalWeightKg), an optional edge-depth input,
// and — for an intra-rest protocol — reps + intra-rest. The captured values ride
// the Start button into the countdown, which logs them when the hold completes.
function TimedSetRow({
  exercise,
  prefill,
  hasWeight = true,
  weightLabel,
  isBodyweight,
  supportsNegativeLoad,
  hasEdgeDepth,
  hasIntraRest,
  onStart,
  onRemove,
}: {
  exercise: WorkExercise
  prefill?: Pick<LoggedSet, 'weightKg' | 'additionalWeightKg' | 'actualReps'>
  hasWeight?: boolean
  weightLabel?: WeightLabel
  isBodyweight?: boolean
  supportsNegativeLoad?: boolean
  hasEdgeDepth?: boolean
  hasIntraRest?: boolean
  onStart: (input: LoggedSetInput) => void
  onRemove?: () => void
}) {
  const weightStep = getWeightStep()
  const [load, setLoad] = useState(() =>
    str(isBodyweight ? (exercise.weight ?? prefill?.additionalWeightKg) : (exercise.weight ?? prefill?.weightKg)),
  )
  const [edge, setEdge] = useState(() => str(exercise.edgeDepthMm))
  const [reps, setReps] = useState(() => str(exercise.abrahangReps))
  const [intra, setIntra] = useState(() => str(exercise.intraRestSeconds))

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
  const bw = getBodyweight()
  const loadNum = load.trim() === '' ? null : Number(load)
  const pct =
    !hasWeight || bw == null || loadNum == null || !Number.isFinite(loadNum)
      ? null
      : isBodyweight
        ? loadNum !== 0
          ? bodyweightLoadPct(loadNum)
          : null
        : loadNum > 0
          ? Math.round((loadNum / bw) * 100)
          : null

  const repsN = hasIntraRest ? (num(reps) ?? 1) : 1
  const startLabel =
    repsN > 1 ? `Start ${repsN}×${exercise.durationSeconds}s` : `Start ${exercise.durationSeconds}s hold`

  function start() {
    const l = num(load)
    const validLoad = l != null && !Number.isNaN(l)
    onStart({
      weightKg: validLoad && !isBodyweight ? l : undefined,
      additionalWeightKg: validLoad && isBodyweight && l !== 0 ? l : undefined,
      edgeDepthMm: hasEdgeDepth ? num(edge) : undefined,
      abrahangReps: hasIntraRest ? num(reps) : undefined,
      intraRestSeconds: hasIntraRest ? num(intra) : undefined,
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-background p-3">
      {hasWeight && (
        <SetField label={loadFieldLabel(weightLabel, supportsNegativeLoad ?? false)}>
          <NumberStepper
            value={load}
            ariaLabel="load"
            step={weightStep}
            min={supportsNegativeLoad ? -999 : 0}
            inputMode="decimal"
            placeholder={isBodyweight ? '0' : 'BW'}
            onChange={setLoad}
          />
        </SetField>
      )}
      {pct != null && (
        <p className="-mt-2 pr-1 text-right text-xs text-muted-foreground">{pct}% of bodyweight</p>
      )}
      {hasEdgeDepth && (
        <SetField label="Edge (mm)">
          <NumberStepper value={edge} ariaLabel="edge depth" min={0} placeholder="20" onChange={setEdge} />
        </SetField>
      )}
      {hasIntraRest && (
        <>
          <SetField label="Reps">
            <NumberStepper value={reps} ariaLabel="reps" min={1} placeholder="6" onChange={setReps} />
          </SetField>
          <SetField label="Intra-rest (s)">
            <NumberStepper value={intra} ariaLabel="intra-rest" min={0} placeholder="3" onChange={setIntra} />
          </SetField>
          <p className="-mt-1 pr-1 text-right text-xs text-muted-foreground">
            Rest between reps within a set.
          </p>
        </>
      )}
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
        <Button className="h-10 flex-1" onClick={start}>
          {startLabel}
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

// Cardio exercise row in a mixed session (A66): a duration (minutes) and an
// optional distance (km) instead of weight/reps. Logs one bout as a LoggedSet
// with durationSeconds + distanceKm.
function CardioSetRow({
  defaultDistanceKm,
  onLog,
  onRemove,
}: {
  defaultDistanceKm?: number
  onLog: (data: LoggedSetInput) => void
  onRemove?: () => void
}) {
  const [minutes, setMinutes] = useState('')
  const [km, setKm] = useState(defaultDistanceKm != null ? String(defaultDistanceKm) : '')
  const clean = (raw: string) => raw.replace(/[^0-9.]/g, '')

  function log() {
    const m = minutes.trim() === '' ? undefined : Number(minutes)
    const d = km.trim() === '' ? undefined : Number(km)
    onLog({
      durationSeconds: m != null && !Number.isNaN(m) ? Math.round(m * 60) : undefined,
      distanceKm: d != null && !Number.isNaN(d) && d > 0 ? d : undefined,
    })
    setMinutes('')
    setKm('')
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-background p-3">
      <SetField label="Duration (min)">
        <Input
          inputMode="decimal"
          value={minutes}
          placeholder="e.g. 20"
          className="h-10 text-center"
          onChange={(e) => setMinutes(clean(e.target.value))}
        />
      </SetField>
      <SetField label="Distance (km)">
        <Input
          inputMode="decimal"
          value={km}
          placeholder="optional"
          className="h-10 text-center"
          onChange={(e) => setKm(clean(e.target.value))}
        />
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
        <Button className="h-10 flex-1" onClick={log} disabled={minutes.trim() === ''}>
          Log
        </Button>
      </div>
    </div>
  )
}

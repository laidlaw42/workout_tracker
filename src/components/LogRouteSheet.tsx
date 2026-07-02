import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { addRoute, updateRoute } from '@/db/helpers'
import {
  EWBANKS_GRADES,
  GYM_GRADES,
  STYLE_LABELS,
  TICK_TYPES,
  V_GRADES,
  ewbanksBandClass,
} from '@/lib/climbing'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ClimbingRoute, ClimbingStyle, ClimbingTick, WallAngle } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  editing: ClimbingRoute | null
  /** Home board: fix style to bouldering (skip step 1) and enter wall angle in degrees. */
  boardMode?: boolean
  /** Gym session: offer the Standard / Gym-grades toggle. */
  gymMode?: boolean
  onSaved: () => void
}

const STYLE_OPTIONS: { value: ClimbingStyle; label: string }[] = [
  { value: 'bouldering', label: 'Bouldering' },
  { value: 'top_rope', label: 'Top rope' },
  { value: 'lead', label: 'Lead' },
]

const WALL_ANGLES: { value: WallAngle; label: string }[] = [
  { value: 'slab', label: 'Slab' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'overhang', label: 'Overhang' },
]

export function LogRouteSheet({
  open,
  onOpenChange,
  sessionId,
  editing,
  boardMode = false,
  gymMode = false,
  onSaved,
}: Props) {
  const firstStep = boardMode ? 2 : 1
  const [step, setStep] = useState(firstStep)
  const [style, setStyle] = useState<ClimbingStyle>('bouldering')
  // Grade system is per-session: kept across route logs (only reset on edit).
  const [gradeSystem, setGradeSystem] = useState<'standard' | 'gym'>('standard')
  const [vGrade, setVGrade] = useState<string | null>(null)
  const [ewbanks, setEwbanks] = useState<number | null>(null)
  const [gymGrade, setGymGrade] = useState<number | null>(null)
  const [feltLike, setFeltLike] = useState<string | null>(null)
  const [wallAngle, setWallAngle] = useState<WallAngle | undefined>(undefined)
  const [wallAngleDeg, setWallAngleDeg] = useState('')
  const [tick, setTick] = useState<ClimbingTick | null>(null)
  const [routeName, setRouteName] = useState('')
  const [colour, setColour] = useState('')
  const [attempts, setAttempts] = useState('')
  const [notes, setNotes] = useState('')

  // Initialise each time the sheet opens (fresh for new, populated for edit).
  useEffect(() => {
    if (!open) return
    setStep(firstStep)
    if (editing) {
      setStyle(boardMode ? 'bouldering' : editing.style)
      setGradeSystem(editing.gymGrade != null ? 'gym' : 'standard')
      setVGrade(editing.vGrade ?? null)
      setEwbanks(editing.ewbanksGrade ?? null)
      setGymGrade(editing.gymGrade ?? null)
      setFeltLike(editing.feltLikeGrade ?? null)
      setWallAngle(editing.wallAngle)
      setWallAngleDeg(editing.wallAngleDegrees != null ? String(editing.wallAngleDegrees) : '')
      setTick(editing.tick)
      setRouteName(editing.routeName ?? '')
      setColour(editing.colour ?? '')
      setAttempts(editing.attempts != null ? String(editing.attempts) : '')
      setNotes(editing.notes ?? '')
    } else {
      // New route: keep the session's grade-system choice; clear the rest.
      setStyle('bouldering')
      setVGrade(null)
      setEwbanks(null)
      setGymGrade(null)
      setFeltLike(null)
      setWallAngle(undefined)
      setWallAngleDeg('')
      setTick(null)
      setRouteName('')
      setColour('')
      setAttempts('')
      setNotes('')
    }
  }, [open, editing, boardMode, firstStep])

  const isBoulder = style === 'bouldering'
  const validTicks = TICK_TYPES[style]

  function chooseStyle(next: ClimbingStyle) {
    setStyle(next)
    // Reset a tick that isn't valid for the new style.
    setTick((t) => (t && TICK_TYPES[next].some((o) => o.value === t) ? t : null))
  }

  function adjustDeg(delta: number) {
    setWallAngleDeg((cur) => {
      const base = cur.trim() === '' || cur === '-' ? 0 : Number(cur)
      const next = (Number.isNaN(base) ? 0 : base) + delta
      return String(Math.max(-45, Math.min(90, next)))
    })
  }

  // Which grade picker to show: gym overrides style; otherwise V for bouldering,
  // Ewbanks for roped.
  const gradeMode: 'v' | 'ewbanks' | 'gym' =
    gradeSystem === 'gym' ? 'gym' : isBoulder ? 'v' : 'ewbanks'
  const gradeOptions: { values: string[]; colored: boolean } =
    gradeMode === 'v'
      ? { values: [...V_GRADES], colored: false }
      : gradeMode === 'gym'
        ? { values: GYM_GRADES.map(String), colored: true }
        : { values: EWBANKS_GRADES.map(String), colored: true }
  const primarySelected =
    gradeMode === 'v' ? vGrade : gradeMode === 'gym' ? (gymGrade != null ? String(gymGrade) : null) : ewbanks != null ? String(ewbanks) : null

  function setPrimary(v: string) {
    if (gradeMode === 'v') setVGrade(v)
    else if (gradeMode === 'gym') setGymGrade(Number(v))
    else setEwbanks(Number(v))
  }

  // Switching systems clears grade choices so standard/gym values never mix.
  function changeGradeSystem(next: 'standard' | 'gym') {
    setGradeSystem(next)
    setVGrade(null)
    setEwbanks(null)
    setGymGrade(null)
    setFeltLike(null)
  }

  const canNextStep2 = primarySelected !== null
  const canSave = tick !== null
  const totalSteps = boardMode ? 2 : 3
  const displayStep = boardMode ? step - 1 : step

  async function save() {
    if (!tick) return
    const degParsed = wallAngleDeg.trim() === '' ? undefined : Number(wallAngleDeg)
    const degClamped =
      degParsed != null && !Number.isNaN(degParsed)
        ? Math.max(-45, Math.min(90, Math.round(degParsed)))
        : undefined
    const record = {
      sessionId,
      style: boardMode ? ('bouldering' as ClimbingStyle) : style,
      vGrade: gradeMode === 'v' ? (vGrade ?? undefined) : undefined,
      ewbanksGrade: gradeMode === 'ewbanks' ? (ewbanks ?? undefined) : undefined,
      gymGrade: gradeMode === 'gym' ? (gymGrade ?? undefined) : undefined,
      feltLikeGrade: feltLike ?? undefined,
      wallAngle: boardMode ? undefined : wallAngle, // enum for gym/crag
      wallAngleDegrees: boardMode ? degClamped : undefined, // degrees for Home board
      routeName: routeName.trim() || undefined,
      colour: colour.trim() || undefined,
      attempts: attempts.trim() ? Number(attempts) : undefined,
      notes: notes.trim() || undefined,
      tick,
      loggedAt: editing ? editing.loggedAt : Date.now(),
    }
    try {
      if (editing) await updateRoute(editing.id, record)
      else await addRoute(record)
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Could not save route')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{editing ? 'Edit route' : 'Log a route'}</SheetTitle>
          <SheetDescription>
            Step {displayStep} of {totalSteps}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-3">
              <Label>Style</Label>
              <SegmentedControl options={STYLE_OPTIONS} value={style} onChange={chooseStyle} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {gymMode && (
                <div className="space-y-2">
                  <Label>Grade system</Label>
                  <SegmentedControl
                    options={[
                      { value: 'standard', label: 'Standard' },
                      { value: 'gym', label: 'Gym grades' },
                    ]}
                    value={gradeSystem}
                    onChange={changeGradeSystem}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {gradeMode === 'gym' ? 'Grade — Gym (0–35)' : `Grade — ${STYLE_LABELS[style]}`}
                </Label>
                <GradeChips options={gradeOptions} selected={primarySelected} onSelect={setPrimary} />
              </div>

              <div className="space-y-2">
                <Label>Felt like (optional)</Label>
                <GradeChips
                  options={gradeOptions}
                  selected={feltLike}
                  onSelect={(v) => setFeltLike((cur) => (cur === v ? null : v))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wall-deg">Wall angle</Label>
                {boardMode ? (
                  <>
                    <div className="flex items-center gap-2">
                      <HoldButton aria-label="Decrease angle" onStep={() => adjustDeg(-1)}>
                        −
                      </HoldButton>
                      <div className="relative flex-1">
                        <Input
                          id="wall-deg"
                          inputMode="numeric"
                          value={wallAngleDeg}
                          placeholder="0"
                          className="pr-6 text-center"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9-]/g, '')
                            if (raw === '' || raw === '-') return setWallAngleDeg(raw)
                            const n = Number(raw)
                            setWallAngleDeg(Number.isNaN(n) ? '' : String(Math.max(-45, Math.min(90, n))))
                          }}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                          °
                        </span>
                      </div>
                      <HoldButton aria-label="Increase angle" onStep={() => adjustDeg(1)}>
                        +
                      </HoldButton>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      −45 to +90 · 0° = vertical, 45° = overhang
                    </p>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {WALL_ANGLES.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setWallAngle((cur) => (cur === a.value ? undefined : a.value))}
                        className={cn(
                          'min-h-10 rounded-lg border text-sm font-medium transition-colors',
                          wallAngle === a.value
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Tick type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {validTicks.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTick(t.value)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors',
                        tick === t.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border',
                      )}
                    >
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="route-name">Route name</Label>
                    <Input
                      id="route-name"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="route-colour">Colour</Label>
                    <Input
                      id="route-colour"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="route-attempts">Attempts</Label>
                  <Input
                    id="route-attempts"
                    inputMode="numeric"
                    value={attempts}
                    onChange={(e) => setAttempts(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="route-notes">Notes</Label>
                  <Textarea
                    id="route-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-border p-4">
          {step > firstStep && (
            <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1"
              disabled={step === 2 && !canNextStep2}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button className="flex-1" disabled={!canSave} onClick={save}>
              Save route
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// A press-and-hold stepper button: one step on tap; while held it repeats,
// accelerating from 1/200ms to 1/80ms after 600ms.
function HoldButton({
  onStep,
  children,
  'aria-label': ariaLabel,
}: {
  onStep: () => void
  children: ReactNode
  'aria-label': string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
  }
  const start = () => {
    stop()
    onStep()
    const startedAt = Date.now()
    const tick = () => {
      onStep()
      timer.current = setTimeout(tick, Date.now() - startedAt > 600 ? 80 : 200)
    }
    timer.current = setTimeout(tick, 200)
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault()
        start()
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="flex size-11 shrink-0 select-none items-center justify-center rounded-lg border border-border text-xl font-semibold text-foreground active:bg-accent"
    >
      {children}
    </button>
  )
}

// A scrollable row of grade chips. Values are strings; numeric scales
// (Ewbanks, gym) are colour-banded, V-grades are not.
function GradeChips({
  options,
  selected,
  onSelect,
}: {
  options: { values: string[]; colored: boolean }
  selected: string | null
  onSelect: (value: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {options.values.map((v) => (
        <GradeChip
          key={v}
          label={v}
          active={selected === v}
          colorClass={options.colored ? ewbanksBandClass(Number(v)) : undefined}
          onClick={() => onSelect(v)}
        />
      ))}
    </div>
  )
}

interface ChipProps {
  label: string
  active: boolean
  onClick: () => void
  colorClass?: string
}

function GradeChip({ label, active, onClick, colorClass }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 font-semibold transition-all',
        colorClass
          ? cn(
              'border-transparent',
              colorClass,
              active ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'opacity-80',
            )
          : active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border',
      )}
    >
      {label}
    </button>
  )
}

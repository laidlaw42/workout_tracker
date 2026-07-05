import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { addRoute, updateRoute } from '@/db/helpers'
import { EWBANKS_GRADES, STYLE_LABELS, TICK_TYPES, V_GRADES } from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import { getGymGradeRanges, type GradeRange } from '@/lib/prefs'
import { ROUTE_COLOURS } from '@/lib/routeColours'
import { SegmentedControl } from '@/components/SegmentedControl'
import { HoldButton } from '@/components/HoldButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type Venue = 'gym' | 'crag' | 'home'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  editing: ClimbingRoute | null
  venue: Venue
  /** Style to log — the sheet opens pre-set to it (Home is always bouldering). */
  style: ClimbingStyle
  /** Gym name, for reading that gym's configured grade range (A22). */
  gymName?: string
  /** Grade system to open a new gym route in — the session's last-used mode (F20). */
  initialGradeSystem?: 'standard' | 'gym'
  /** Called when the user switches grade system, so the session can remember it (F20). */
  onGradeSystemChange?: (mode: 'standard' | 'gym') => void
  onSaved: () => void
}

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
  venue,
  style: styleProp,
  gymName,
  initialGradeSystem,
  onGradeSystemChange,
  onSaved,
}: Props) {
  const isBoard = venue === 'home'
  const isGym = venue === 'gym'

  const [style, setStyle] = useState<ClimbingStyle>(styleProp)
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
  // Gym-grade ranges are read fresh (for this gym) each time the sheet opens.
  const [gymRanges, setGymRanges] = useState(() => getGymGradeRanges(gymName ?? ''))

  // Initialise each time the sheet opens (fresh for new, populated for edit).
  // `initialGradeSystem` is read here but intentionally NOT a dependency: it
  // seeds the mode on open only. Were it a dep, the parent mirroring a mid-sheet
  // toggle back down would re-run this reset and wipe the in-progress entry.
  useEffect(() => {
    if (!open) return
    setGymRanges(getGymGradeRanges(gymName ?? ''))
    if (editing) {
      setStyle(editing.style)
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
      // New route: pre-set the chosen style and open in the session's last-used
      // grade system (F20).
      setStyle(styleProp)
      setGradeSystem(initialGradeSystem ?? 'standard')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, styleProp, gymName])

  const isBoulder = style === 'bouldering'
  const validTicks = TICK_TYPES[style]
  // Onsight / flash imply a single attempt, so the field is locked to 1 (A23).
  const attemptsLocked = tick === 'onsight' || tick === 'flash'

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
  const gymRange: GradeRange = gymRanges[style]
  const gradeValues: string[] =
    gradeMode === 'v'
      ? [...V_GRADES]
      : gradeMode === 'gym'
        ? Array.from({ length: gymRange.max - gymRange.min + 1 }, (_, i) => String(gymRange.min + i))
        : EWBANKS_GRADES.map(String)
  const primarySelected =
    gradeMode === 'v'
      ? vGrade
      : gradeMode === 'gym'
        ? gymGrade != null
          ? String(gymGrade)
          : null
        : ewbanks != null
          ? String(ewbanks)
          : null

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
    onGradeSystemChange?.(next) // remember the session's grade mode (F20)
  }

  const canSave = tick !== null && primarySelected !== null
  const styleLabel = STYLE_LABELS[style]

  async function save() {
    if (!tick) return
    const degParsed = wallAngleDeg.trim() === '' ? undefined : Number(wallAngleDeg)
    const degClamped =
      degParsed != null && !Number.isNaN(degParsed)
        ? Math.max(-45, Math.min(90, Math.round(degParsed)))
        : undefined
    const record = {
      sessionId,
      style,
      vGrade: gradeMode === 'v' ? (vGrade ?? undefined) : undefined,
      ewbanksGrade: gradeMode === 'ewbanks' ? (ewbanks ?? undefined) : undefined,
      gymGrade: gradeMode === 'gym' ? (gymGrade ?? undefined) : undefined,
      feltLikeGrade: feltLike ?? undefined,
      wallAngle: isBoard ? undefined : wallAngle, // enum for gym/crag
      wallAngleDegrees: isBoard ? degClamped : undefined, // degrees for Home board
      routeName: routeName.trim() || undefined,
      colour: isGym ? colour.trim() || undefined : undefined, // colour is Gym-only (A23)
      attempts: attemptsLocked ? 1 : attempts.trim() ? Number(attempts) : undefined,
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
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{editing ? 'Edit route' : `Log ${styleLabel}`}</SheetTitle>
          <SheetDescription className="sr-only">Route details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* 1 — Grade (with the Standard / Gym toggle for gyms) */}
          {isGym && (
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
            <Label>{gradeMode === 'gym' ? 'Grade — Gym' : `Grade — ${styleLabel}`}</Label>
            <GradeChips
              mode={gradeMode}
              values={gradeValues}
              selected={primarySelected}
              onSelect={setPrimary}
            />
          </div>

          {/* 2 — Felt like */}
          <div className="space-y-2">
            <Label>Felt like</Label>
            <GradeChips
              mode={gradeMode}
              values={gradeValues}
              selected={feltLike}
              onSelect={(v) => setFeltLike((cur) => (cur === v ? null : v))}
            />
          </div>

          {/* 3 — Tick type */}
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
                    tick === t.value ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4 — Wall angle */}
          <div className="space-y-2">
            <Label htmlFor="wall-deg">Wall angle</Label>
            {isBoard ? (
              <>
                <div className="flex items-center gap-2">
                  <HoldButton
                    aria-label="Decrease angle"
                    onStep={() => adjustDeg(-1)}
                    className="size-11 text-xl font-semibold"
                  >
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
                  <HoldButton
                    aria-label="Increase angle"
                    onStep={() => adjustDeg(1)}
                    className="size-11 text-xl font-semibold"
                  >
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

          {/* 5 — Attempts (locked to 1 for onsight / flash) */}
          <div className="space-y-1.5">
            <Label htmlFor="route-attempts">Attempts</Label>
            <Input
              id="route-attempts"
              inputMode="numeric"
              readOnly={attemptsLocked}
              value={attemptsLocked ? '1' : attempts}
              placeholder="optional"
              className={cn(attemptsLocked && 'text-muted-foreground')}
              onChange={(e) => setAttempts(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>

          {/* 6 — Colour (Gym only) */}
          {isGym && (
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Select value={colour} onValueChange={setColour}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select colour" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTE_COLOURS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3.5 rounded-full border border-border"
                          style={{ background: c.swatch }}
                        />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 7 — Route name */}
          <div className="space-y-1.5">
            <Label htmlFor="route-name">Route name</Label>
            <Input id="route-name" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
          </div>

          {/* 8 — Notes */}
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

        <div className="border-t border-border p-4">
          <Button className="w-full" disabled={!canSave} onClick={save}>
            {editing ? 'Save changes' : 'Save route'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// A scrollable row of grade chips. Every chip is coloured by its grade: V-grades
// via vGradeToColor; Ewbanks via gradeToColor. Gym grades are not hue-mapped
// (F25) — those chips render in a neutral style (color === undefined).
function GradeChips({
  mode,
  values,
  selected,
  onSelect,
}: {
  mode: 'v' | 'ewbanks' | 'gym'
  values: string[]
  selected: string | null
  onSelect: (value: string) => void
}) {
  const colorFor = (v: string): string | undefined =>
    mode === 'v' ? vGradeToColor(v) : mode === 'gym' ? undefined : gradeToColor(Number(v))
  return (
    // min-h + vertical padding: overflow-x-auto also clips the Y axis, so the
    // chips (and the active ring-offset) need headroom or the top row is cut off.
    <div className="flex min-h-16 items-center gap-2 overflow-x-auto px-0.5 py-2">
      {values.map((v) => (
        <GradeChip
          key={v}
          label={v}
          active={selected === v}
          color={colorFor(v)}
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
  /** Grade colour; undefined renders the neutral style (gym grades, F25). */
  color?: string
}

function GradeChip({ label, active, onClick, color }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={color ? { backgroundColor: color, color: contrastText(color) } : undefined}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 font-semibold transition-all',
        color ? 'border-transparent' : 'border-border bg-muted text-foreground',
        active
          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : color
            ? 'opacity-80'
            : 'text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}

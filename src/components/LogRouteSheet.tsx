import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { addRoute, updateRoute } from '@/db/helpers'
import {
  CLIMB_CHARACTERS,
  CLIMB_STYLE_TAGS,
  EWBANKS_GRADES,
  STYLE_LABELS,
  TICK_TYPES,
  V_GRADES,
} from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import { getGymGradeRanges, type GradeRange } from '@/lib/prefs'
import {
  ROUTE_COLOURS,
  customRouteColours,
  findRouteColour,
  type RouteColour,
} from '@/lib/routeColours'
import { tickIndicator } from '@/lib/tickTypes'
import { useTickDisplayStyle } from '@/hooks/useTickSymbol'
import { SegmentedControl } from '@/components/SegmentedControl'
import { HoldButton } from '@/components/HoldButton'
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
import type { ClimbCharacter, ClimbingRoute, ClimbingStyle, ClimbingTick } from '@/types'

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
  // Degree input is shown for Home (−45..90) and Gym (0..90); Crag has none (A45).
  const showDegrees = isBoard || isGym
  const degMin = isBoard ? -45 : 0

  const [style, setStyle] = useState<ClimbingStyle>(styleProp)
  // Grade system is per-session: kept across route logs (only reset on edit).
  const [gradeSystem, setGradeSystem] = useState<'standard' | 'gym'>('standard')
  const [vGrade, setVGrade] = useState<string | null>(null)
  const [ewbanks, setEwbanks] = useState<number | null>(null)
  const [gymGrade, setGymGrade] = useState<number | null>(null)
  const [feltLike, setFeltLike] = useState<string | null>(null)
  const [climbCharacter, setClimbCharacter] = useState<ClimbCharacter | undefined>(undefined)
  const [climbStyles, setClimbStyles] = useState<string[]>([])
  const [wallAngleDeg, setWallAngleDeg] = useState('')
  const [tick, setTick] = useState<ClimbingTick | null>(null)
  const [routeName, setRouteName] = useState('')
  const [colour, setColour] = useState('')
  const [attempts, setAttempts] = useState('')
  const [height, setHeight] = useState('')
  const [notes, setNotes] = useState('')
  // Gym-grade ranges are read fresh (for this gym) each time the sheet opens.
  const [gymRanges, setGymRanges] = useState(() => getGymGradeRanges(gymName ?? ''))
  // Custom gym colours (A43), re-read each time the sheet opens.
  const [customColours, setCustomColours] = useState<RouteColour[]>(() => customRouteColours())

  // Initialise each time the sheet opens (fresh for new, populated for edit).
  // `initialGradeSystem` is read here but intentionally NOT a dependency: it
  // seeds the mode on open only. Were it a dep, the parent mirroring a mid-sheet
  // toggle back down would re-run this reset and wipe the in-progress entry.
  useEffect(() => {
    if (!open) return
    setGymRanges(getGymGradeRanges(gymName ?? ''))
    setCustomColours(customRouteColours())
    if (editing) {
      setStyle(editing.style)
      setGradeSystem(editing.gymGrade != null ? 'gym' : 'standard')
      setVGrade(editing.vGrade ?? null)
      setEwbanks(editing.ewbanksGrade ?? null)
      setGymGrade(editing.gymGrade ?? null)
      setFeltLike(editing.feltLikeGrade ?? null)
      // Migrate a legacy wallAngle to climbCharacter (A45) — they map 1:1.
      setClimbCharacter(editing.climbCharacter ?? editing.wallAngle)
      setClimbStyles(editing.climbStyles ?? [])
      setWallAngleDeg(editing.wallAngleDegrees != null ? String(editing.wallAngleDegrees) : '')
      setTick(editing.tick)
      setRouteName(editing.routeName ?? '')
      setColour(editing.colour ?? '')
      setAttempts(editing.attempts != null ? String(editing.attempts) : '')
      setHeight(editing.heightMetres != null ? String(editing.heightMetres) : '')
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
      setClimbCharacter(undefined)
      setClimbStyles([])
      setWallAngleDeg('')
      setTick(null)
      setRouteName('')
      setColour('')
      setAttempts('')
      setHeight('')
      setNotes('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, styleProp, gymName])

  const isBoulder = style === 'bouldering'
  const validTicks = TICK_TYPES[style]
  const tickStyle = useTickDisplayStyle()
  // Onsight / flash imply a single attempt, so the field is locked to 1 (A23).
  const attemptsLocked = tick === 'onsight' || tick === 'flash'

  function adjustDeg(delta: number) {
    setWallAngleDeg((cur) => {
      const base = cur.trim() === '' || cur === '-' ? 0 : Number(cur)
      const next = (Number.isNaN(base) ? 0 : base) + delta
      return String(Math.max(degMin, Math.min(90, next)))
    })
  }

  // A44 — route height in metres, in 0.5 m steps (0 clears the field).
  function adjustHeight(delta: number) {
    setHeight((cur) => {
      const base = cur.trim() === '' ? 0 : Number(cur)
      const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + delta)
      return next === 0 ? '' : String(next)
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

  // A stored gym grade/felt value can fall outside this gym's current range —
  // e.g. a legacy route after F25 narrowed the default to 1–10. Union it in so
  // its chip still renders and stays highlighted when editing.
  const chipValues =
    gradeMode === 'gym'
      ? [...new Set([...gradeValues, primarySelected, feltLike].filter((v): v is string => v != null))].sort(
          (a, b) => Number(a) - Number(b),
        )
      : gradeValues

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
        ? Math.max(degMin, Math.min(90, Math.round(degParsed)))
        : undefined
    const record = {
      sessionId,
      style,
      vGrade: gradeMode === 'v' ? (vGrade ?? undefined) : undefined,
      ewbanksGrade: gradeMode === 'ewbanks' ? (ewbanks ?? undefined) : undefined,
      gymGrade: gradeMode === 'gym' ? (gymGrade ?? undefined) : undefined,
      feltLikeGrade: feltLike ?? undefined,
      climbCharacter, // A45 — supersedes wallAngle
      wallAngle: undefined, // cleared: migrated to climbCharacter (A45)
      climbStyles: climbStyles.length ? climbStyles : undefined, // A47
      wallAngleDegrees: showDegrees ? degClamped : undefined, // Home −45..90 / Gym 0..90
      routeName: routeName.trim() || undefined,
      colour: isGym ? colour.trim() || undefined : undefined, // colour is Gym-only (A23)
      heightMetres: height.trim() === '' ? undefined : Number(height), // A44
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
              values={chipValues}
              selected={primarySelected}
              onSelect={setPrimary}
            />
          </div>

          {/* 2 — Felt like */}
          <div className="space-y-2">
            <Label>Felt like</Label>
            <GradeChips
              mode={gradeMode}
              values={chipValues}
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
                  <span className="text-sm font-medium">
                    <span aria-hidden className="mr-1">
                      {tickIndicator(t.value, tickStyle)}
                    </span>
                    {t.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4 — Character (A45) — replaces the old Slab/Vertical/Overhang toggle. */}
          <div className="space-y-2">
            <Label>Character</Label>
            <div className="grid grid-cols-3 gap-2">
              {CLIMB_CHARACTERS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setClimbCharacter((cur) => (cur === c.value ? undefined : c.value))}
                  className={cn(
                    'min-h-10 rounded-lg border text-sm font-medium transition-colors',
                    climbCharacter === c.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {showDegrees && (
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
                      placeholder="Angle (°) — optional"
                      className="pr-6 text-center"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9-]/g, '')
                        if (raw === '' || raw === '-') return setWallAngleDeg(raw)
                        const n = Number(raw)
                        setWallAngleDeg(Number.isNaN(n) ? '' : String(Math.max(degMin, Math.min(90, n))))
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
                  {isBoard ? '−45 to +90 · 0° = vertical, 45° = overhang' : '0–90° · optional'}
                </p>
              </>
            )}
          </div>

          {/* 4b — Style tags (A47) */}
          <div className="space-y-2">
            <Label>Style</Label>
            <div className="flex flex-wrap gap-2">
              {CLIMB_STYLE_TAGS.map((s) => {
                const on = climbStyles.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setClimbStyles((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
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

          {/* 6 — Colour (Gym only). Inline 44px swatch grid rather than a Radix
              Select popover: avoids nested popover/Sheet event + z-index issues
              and gives a reliable touch target (F28). */}
          {isGym && (
            <div className="space-y-1.5">
              <Label>Colour{colour ? ` — ${findRouteColour(colour)?.label ?? colour}` : ''}</Label>
              <div className="flex flex-wrap gap-2">
                {ROUTE_COLOURS.map((c) => (
                  <ColourSwatch
                    key={c.value}
                    colour={c}
                    selected={colour === c.value}
                    onSelect={() => setColour(colour === c.value ? '' : c.value)}
                  />
                ))}
              </div>
              {customColours.length > 0 && (
                <>
                  <p className="pt-1 text-xs text-muted-foreground">Custom</p>
                  <div className="flex flex-wrap gap-2">
                    {customColours.map((c) => (
                      <ColourSwatch
                        key={c.value}
                        colour={c}
                        selected={colour === c.value}
                        onSelect={() => setColour(colour === c.value ? '' : c.value)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 7 — Route name */}
          <div className="space-y-1.5">
            <Label htmlFor="route-name">Route name</Label>
            <Input id="route-name" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
          </div>

          {/* 7b — Height (A44) — optional, 0.5 m steps */}
          <div className="space-y-1.5">
            <Label htmlFor="route-height">Height (m)</Label>
            <div className="flex items-center gap-2">
              <HoldButton
                aria-label="Decrease height"
                onStep={() => adjustHeight(-0.5)}
                className="size-11 text-xl font-semibold"
              >
                −
              </HoldButton>
              <div className="relative flex-1">
                <Input
                  id="route-height"
                  inputMode="decimal"
                  value={height}
                  placeholder="Height (m) — optional"
                  className="pr-6 text-center"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '')
                    if (raw === '' || raw === '.') return setHeight(raw === '.' ? '0.' : '')
                    const n = Number(raw)
                    setHeight(Number.isNaN(n) ? '' : raw)
                  }}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  m
                </span>
              </div>
              <HoldButton
                aria-label="Increase height"
                onStep={() => adjustHeight(0.5)}
                className="size-11 text-xl font-semibold"
              >
                +
              </HoldButton>
            </div>
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

// A 44px hold-colour swatch (F28), reused for built-in and custom colours (A43).
function ColourSwatch({
  colour,
  selected,
  onSelect,
}: {
  colour: RouteColour
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={colour.label}
      aria-pressed={selected}
      title={colour.label}
      onClick={onSelect}
      className={cn(
        'relative flex size-11 items-center justify-center rounded-lg border transition-all',
        selected
          ? 'border-transparent ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : 'border-border',
      )}
      style={{ background: colour.swatch }}
    >
      {selected && (
        <Check className="size-5 drop-shadow" style={{ color: contrastText(colour.solid ?? '#808080') }} />
      )}
    </button>
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

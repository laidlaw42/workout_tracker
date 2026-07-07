import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown } from 'lucide-react'
import { addRoute, updateRoute } from '@/db/helpers'
import {
  CLIMB_CHARACTERS,
  CLIMB_STYLE_TAGS,
  EWBANKS_GRADES,
  STYLE_LABELS,
  TICK_TYPES,
  V_GRADES,
  climbStyleLabel,
} from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import {
  getCustomClimbStyles,
  getGymArea,
  getGymAreas,
  getGymGradeRanges,
  type GradeRange,
} from '@/lib/prefs'
import {
  ROUTE_COLOURS,
  customRouteColours,
  findRouteColour,
  type RouteColour,
} from '@/lib/routeColours'
import { tickIndicator } from '@/lib/tickTypes'
import { useTickDisplayStyle } from '@/hooks/useTickSymbol'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SelectPill } from '@/components/SelectPill'
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

type Venue = 'gym' | 'crag' | 'board'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  editing: ClimbingRoute | null
  venue: Venue
  /** Whether this is genuinely a Crag session (not a venue-less climbing session
   *  coerced to 'crag'); gates the A64 Sport/Trad toggle. */
  cragSession?: boolean
  /** Style to log — the sheet opens pre-set to it (Home is always bouldering). */
  style: ClimbingStyle
  /** Gym name, for reading that gym's configured grade range (A22) and area
   *  defaults (A83). */
  gymName?: string
  onSaved: () => void
}

export function LogRouteSheet({
  open,
  onOpenChange,
  sessionId,
  editing,
  venue,
  cragSession = false,
  style: styleProp,
  gymName,
  onSaved,
}: Props) {
  const isBoard = venue === 'board'
  const isGym = venue === 'gym'
  // Degree input is shown for Board (−45..90) and Gym (0..90); Crag has none (A45).
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
  const [gymArea, setGymArea] = useState('') // A69
  const [areaOther, setAreaOther] = useState(false) // A69 — freetext "Other" active
  const [attempts, setAttempts] = useState('1') // A71 — default 1 for every tick
  const [height, setHeight] = useState('')
  const [notes, setNotes] = useState('')
  // Crag lead/top-rope route type (A64) and the collapsible "Felt like" state (A65).
  const [routeType, setRouteType] = useState<'sport' | 'trad' | undefined>(undefined)
  const [feltOpen, setFeltOpen] = useState(false)
  // Gym-grade ranges are read fresh (for this gym) each time the sheet opens.
  const [gymRanges, setGymRanges] = useState(() => getGymGradeRanges(gymName ?? ''))
  // Custom gym colours (A43), re-read each time the sheet opens.
  const [customColours, setCustomColours] = useState<RouteColour[]>(() => customRouteColours())
  // Gym areas (A69) and custom climb styles (A72), re-read each time it opens.
  const [areas, setAreas] = useState<string[]>(() => getGymAreas(gymName ?? ''))
  const [customStyles, setCustomStyles] = useState<string[]>(() => getCustomClimbStyles())

  // Initialise each time the sheet opens (fresh for new, populated for edit).
  useEffect(() => {
    if (!open) return
    setGymRanges(getGymGradeRanges(gymName ?? ''))
    setCustomColours(customRouteColours())
    const gymAreas = getGymAreas(gymName ?? '')
    setAreas(gymAreas)
    setCustomStyles(getCustomClimbStyles())
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
      setGymArea(editing.gymArea ?? '')
      // An area that isn't one of this gym's saved areas is a freetext "Other".
      setAreaOther(!!editing.gymArea && !gymAreas.includes(editing.gymArea))
      setAttempts(editing.attempts != null ? String(editing.attempts) : '1')
      setHeight(editing.heightMetres != null ? String(editing.heightMetres) : '')
      setNotes(editing.notes ?? '')
      setRouteType(editing.routeType)
      // A65 — open "Felt like" when a value already exists, so it's visible (B3).
      setFeltOpen(editing.feltLikeGrade != null)
    } else {
      // New route: pre-set the chosen style. A84 — gym sessions always open in
      // gym grades (the toggle stays available); everything else is standard.
      setStyle(styleProp)
      setGradeSystem(isGym ? 'gym' : 'standard')
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
      setGymArea('')
      setAreaOther(false)
      setAttempts('1')
      setHeight('')
      setNotes('')
      setRouteType(undefined)
      setFeltOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, styleProp, gymName])

  const isBoulder = style === 'bouldering'
  // Sport/Trad applies only to genuine Crag roped climbs (A64); hidden for
  // venue-less climbing sessions coerced to 'crag', bouldering, gym and board.
  const showRouteType = cragSession && (style === 'lead' || style === 'top_rope')
  const validTicks = TICK_TYPES[style]
  const tickStyle = useTickDisplayStyle()

  // A71 — attempts stepper, minimum 1 (default 1 for every tick type).
  function adjustAttempts(delta: number) {
    setAttempts((cur) => {
      const base = cur.trim() === '' ? 1 : Number(cur)
      return String(Math.max(1, (Number.isNaN(base) ? 1 : base) + delta))
    })
  }

  function toggleStyle(s: string) {
    setClimbStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  }

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
  }

  // A83 — selecting a saved area pre-fills height/character from its defaults (if
  // configured); the user can still override. Pre-fill only when logging a NEW
  // route and only when actually switching areas, so it never clobbers a route's
  // logged values (edit mode) or an override typed after picking the same area.
  function selectArea(name: string) {
    const changed = name !== gymArea
    setAreaOther(false)
    setGymArea(name)
    if (editing || !changed) return
    const cfg = getGymArea(gymName ?? '', name)
    if (cfg?.defaultHeightMetres != null) setHeight(String(cfg.defaultHeightMetres))
    if (cfg?.defaultCharacter != null) setClimbCharacter(cfg.defaultCharacter)
    if (cfg?.defaultAngleDegrees != null) setWallAngleDeg(String(cfg.defaultAngleDegrees)) // F48
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
      routeType: showRouteType ? routeType : undefined, // A64 — Crag roped only
      gymArea: isGym ? gymArea.trim() || undefined : undefined, // A69 — Gym-only
      heightMetres: height.trim() === '' ? undefined : Number(height), // A44
      attempts: Math.max(1, Number(attempts) || 1), // A71 — always ≥ 1, default 1
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
          {/* Area (A69) — Gym only, and the first field (A84) so picking it can
              pre-fill height/character defaults (A83) before anything else.
              Single-select pills (+ None / freetext Other) rather than a Radix
              Select, to avoid the nested popover/Sheet issues that drove F28. */}
          {isGym && (
            <div className="space-y-1.5">
              <Label>Area{gymArea ? ` — ${gymArea}` : ''}</Label>
              <div className="flex flex-wrap gap-2">
                <SelectPill
                  label="None"
                  active={!areaOther && !gymArea}
                  onClick={() => {
                    setAreaOther(false)
                    setGymArea('')
                  }}
                />
                {areas.map((a) => (
                  <SelectPill
                    key={a}
                    label={a}
                    active={!areaOther && gymArea === a}
                    onClick={() => selectArea(a)}
                  />
                ))}
                <SelectPill
                  label="Other"
                  active={areaOther}
                  onClick={() => {
                    setAreaOther(true)
                    setGymArea('')
                  }}
                />
              </div>
              {areaOther && (
                <Input
                  value={gymArea}
                  placeholder="Area name"
                  onChange={(e) => setGymArea(e.target.value)}
                />
              )}
            </div>
          )}

          {/* 0 — Route type (A64) — Crag lead / top rope only; metadata only. */}
          {showRouteType && (
            <div className="space-y-2">
              <Label>Route type</Label>
              <SegmentedControl<'sport' | 'trad'>
                options={[
                  { value: 'sport', label: 'Sport' },
                  { value: 'trad', label: 'Trad' },
                ]}
                value={(routeType ?? '') as 'sport' | 'trad'}
                onChange={setRouteType}
              />
            </div>
          )}

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

          {/* 2 — Felt like (A65) — collapsed by default; the sheet body scrolls,
              so expanding grows it rather than pushing content off-screen. */}
          <div className="space-y-2">
            <button
              type="button"
              aria-expanded={feltOpen}
              onClick={() => setFeltOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md py-1 text-left"
            >
              <Label className="pointer-events-none">
                Felt like{feltLike ? ` — ${feltLike}` : ''}
              </Label>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  feltOpen && 'rotate-180',
                )}
              />
            </button>
            {feltOpen && (
              <GradeChips
                mode={gradeMode}
                values={chipValues}
                selected={feltLike}
                onSelect={(v) => setFeltLike((cur) => (cur === v ? null : v))}
              />
            )}
          </div>

          {/* 3 — Colour (Gym only) — sits beneath Felt like. Inline 44px swatch
              grid rather than a Radix Select popover: avoids nested popover/Sheet
              event + z-index issues and gives a reliable touch target (F28). */}
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

          {/* 4 — Attempts (above Tick type) — A71 stepper, default 1, minimum 1 */}
          <div className="space-y-1.5">
            <Label htmlFor="route-attempts">Attempts</Label>
            <div className="flex items-center gap-2">
              <HoldButton
                aria-label="Decrease attempts"
                disabled={(Number(attempts) || 1) <= 1}
                onStep={() => adjustAttempts(-1)}
                className="size-11 text-xl font-semibold"
              >
                −
              </HoldButton>
              <Input
                id="route-attempts"
                inputMode="numeric"
                value={attempts}
                className="flex-1 text-center"
                onChange={(e) => setAttempts(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => setAttempts((cur) => String(Math.max(1, Number(cur) || 1)))}
              />
              <HoldButton
                aria-label="Increase attempts"
                onStep={() => adjustAttempts(1)}
                className="size-11 text-xl font-semibold"
              >
                +
              </HoldButton>
            </div>
          </div>

          {/* 5 — Tick type */}
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

          {/* 6 — Character (A45) — replaces the old Slab/Vertical/Overhang toggle. */}
          <div className="space-y-2">
            <Label>Character</Label>
            <div className="grid grid-cols-3 gap-2">
              {CLIMB_CHARACTERS.map((c) => {
                const Icon = c.icon // A63 — wall-shape icon above the label
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setClimbCharacter((cur) => (cur === c.value ? undefined : c.value))}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors',
                      climbCharacter === c.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <Icon aria-hidden className={cn('size-4', c.iconClassName)} />
                    {c.label}
                  </button>
                )
              })}
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

          {/* 6c — Height (A44) — optional, 0.5 m steps. Sits directly below the
              wall angle / character field for every venue (F33). */}
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

          {/* 6b — Style tags (A47, A72). Fixed tags, then user-defined custom
              styles after a subtle divider. */}
          <div className="space-y-2">
            <Label>Style</Label>
            <div className="flex flex-wrap gap-2">
              {CLIMB_STYLE_TAGS.map((s) => (
                <SelectPill
                  key={s}
                  label={climbStyleLabel(s)}
                  active={climbStyles.includes(s)}
                  onClick={() => toggleStyle(s)}
                />
              ))}
            </div>
            {customStyles.length > 0 && (
              <>
                <div className="mt-1 border-t border-border/60" />
                <div className="flex flex-wrap gap-2 pt-1">
                  {customStyles.map((s) => (
                    <SelectPill
                      key={s}
                      label={s}
                      active={climbStyles.includes(s)}
                      onClick={() => toggleStyle(s)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

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

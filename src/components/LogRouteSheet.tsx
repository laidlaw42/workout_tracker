import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { addRoute, updateRoute } from '@/db/helpers'
import {
  EWBANKS_GRADES,
  STYLE_LABELS,
  TICK_TYPES,
  V_GRADES,
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

export function LogRouteSheet({ open, onOpenChange, sessionId, editing, onSaved }: Props) {
  const [step, setStep] = useState(1)
  const [style, setStyle] = useState<ClimbingStyle>('bouldering')
  const [vGrade, setVGrade] = useState<string | null>(null)
  const [ewbanks, setEwbanks] = useState<number | null>(null)
  const [wallAngle, setWallAngle] = useState<WallAngle | undefined>(undefined)
  const [tick, setTick] = useState<ClimbingTick | null>(null)
  const [routeName, setRouteName] = useState('')
  const [colour, setColour] = useState('')
  const [attempts, setAttempts] = useState('')
  const [notes, setNotes] = useState('')

  // Initialise each time the sheet opens (fresh for new, populated for edit).
  useEffect(() => {
    if (!open) return
    setStep(1)
    if (editing) {
      setStyle(editing.style)
      setVGrade(editing.vGrade ?? null)
      setEwbanks(editing.ewbanksGrade ?? null)
      setWallAngle(editing.wallAngle)
      setTick(editing.tick)
      setRouteName(editing.routeName ?? '')
      setColour(editing.colour ?? '')
      setAttempts(editing.attempts != null ? String(editing.attempts) : '')
      setNotes(editing.notes ?? '')
    } else {
      setStyle('bouldering')
      setVGrade(null)
      setEwbanks(null)
      setWallAngle(undefined)
      setTick(null)
      setRouteName('')
      setColour('')
      setAttempts('')
      setNotes('')
    }
  }, [open, editing])

  const isBoulder = style === 'bouldering'
  const validTicks = TICK_TYPES[style]

  function chooseStyle(next: ClimbingStyle) {
    setStyle(next)
    // Reset a tick that isn't valid for the new style.
    setTick((t) => (t && TICK_TYPES[next].some((o) => o.value === t) ? t : null))
  }

  const canNextStep2 = isBoulder ? vGrade !== null : ewbanks !== null
  const canSave = tick !== null

  async function save() {
    if (!tick) return
    const record = {
      sessionId,
      style,
      vGrade: isBoulder ? (vGrade ?? undefined) : undefined,
      ewbanksGrade: isBoulder ? undefined : (ewbanks ?? undefined),
      wallAngle: isBoulder ? wallAngle : undefined,
      routeName: routeName.trim() || undefined,
      colour: colour.trim() || undefined,
      attempts: attempts.trim() ? Number(attempts) : undefined,
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
          <SheetDescription>Step {step} of 3</SheetDescription>
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
              <div className="space-y-2">
                <Label>Grade — {STYLE_LABELS[style]}</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {isBoulder
                    ? V_GRADES.map((g) => (
                        <GradeChip key={g} label={g} active={vGrade === g} onClick={() => setVGrade(g)} />
                      ))
                    : EWBANKS_GRADES.map((g) => (
                        <GradeChip
                          key={g}
                          label={String(g)}
                          active={ewbanks === g}
                          onClick={() => setEwbanks(g)}
                        />
                      ))}
                </div>
              </div>

              {isBoulder && (
                <div className="space-y-2">
                  <Label>Wall angle</Label>
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
                </div>
              )}
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
          {step > 1 && (
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

interface ChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function GradeChip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
      )}
    >
      {label}
    </button>
  )
}

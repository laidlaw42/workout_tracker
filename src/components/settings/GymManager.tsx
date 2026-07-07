import { useEffect, useState } from 'react'
import { ChevronRight, Minus, Plus, Trash2 } from 'lucide-react'
import {
  addGymArea,
  deleteGym,
  getGymAreaList,
  getGymGradeRanges,
  getSavedLocations,
  rememberLocation,
  removeGymArea,
  renameGym,
  renameGymArea,
  setGymGradeRanges,
  updateGymAreaDefaults,
  type GradeRange,
  type GymArea,
  type GymGradeRanges,
  type GymStyle,
} from '@/lib/prefs'
import { CLIMB_CHARACTERS } from '@/lib/climbing'
import { DefaultLocationRow } from '@/components/settings/DefaultLocationRow'
import { SelectPill } from '@/components/SelectPill'
import { HoldButton } from '@/components/HoldButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Settings section for saved gyms (A22/A51): add/remove, per-gym grade ranges
// and areas (edited in a sheet), and the default-gym row.
export function GymManager() {
  const [gyms, setGyms] = useState(() => getSavedLocations('gym'))
  const [newGym, setNewGym] = useState('')
  const [editGym, setEditGym] = useState<string | null>(null)

  function handleAddGym() {
    rememberLocation('gym', newGym)
    setGyms(getSavedLocations('gym'))
    setNewGym('')
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Gyms</h2>
      <div className="flex gap-2">
        <Input
          value={newGym}
          placeholder="Add a gym"
          onChange={(e) => setNewGym(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddGym()
          }}
        />
        <Button onClick={handleAddGym} disabled={!newGym.trim()}>
          Add gym
        </Button>
      </div>
      {gyms.length > 0 ? (
        <div className="space-y-2">
          {gyms.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setEditGym(g)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors active:bg-accent"
            >
              <span className="text-sm">{g}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          Gyms you climb at are saved here. Tap one to set its grade ranges.
        </p>
      )}

      {/* A51 — a saved default skips the name prompt on session start. */}
      <div className="pt-2">
        <DefaultLocationRow type="gym" label="Default gym" />
      </div>

      <GymEditSheet
        gym={editGym}
        onClose={() => setEditGym(null)}
        onChanged={() => setGyms(getSavedLocations('gym'))}
      />
    </section>
  )
}

// Edit one gym's grade ranges (A22); also rename or delete it from the saved list.
function GymEditSheet({
  gym,
  onClose,
  onChanged,
}: {
  gym: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [ranges, setRanges] = useState<GymGradeRanges>(() => getGymGradeRanges(''))
  const [areas, setAreas] = useState<GymArea[]>([]) // A69 / A83 (name + defaults)
  const [newArea, setNewArea] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (gym == null) return
    setName(gym)
    setRanges(getGymGradeRanges(gym))
    setAreas(getGymAreaList(gym))
    setNewArea('')
    setConfirmDelete(false)
  }, [gym])

  // Areas persist immediately (keyed by the original gym name); a rename on Save
  // migrates them via renameGym.
  function addArea() {
    if (gym == null) return
    const n = newArea.trim()
    if (!n) return
    setAreas(addGymArea(gym, n))
    setNewArea('')
  }

  function step(style: GymStyle, bound: 'min' | 'max', delta: number) {
    setRanges((cur) => {
      const r = cur[style]
      const min = bound === 'min' ? Math.max(0, Math.min(r.max, r.min + delta)) : r.min
      const max = bound === 'max' ? Math.min(35, Math.max(r.min, r.max + delta)) : r.max
      return { ...cur, [style]: { min, max } }
    })
  }
  function save() {
    if (gym == null) return
    const newName = name.trim() || gym
    if (newName !== gym) renameGym(gym, newName)
    setGymGradeRanges(newName, ranges)
    onChanged()
    onClose()
  }
  function remove() {
    if (gym == null) return
    deleteGym(gym)
    setConfirmDelete(false)
    onChanged()
    onClose()
  }

  return (
    <Sheet open={gym !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Edit gym</SheetTitle>
          <SheetDescription className="sr-only">Gym name and grade ranges</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-1.5">
            <Label htmlFor="gym-name">Name</Label>
            <Input id="gym-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <p className="px-1 text-xs text-muted-foreground">Grade ranges (0–35)</p>
          <RangeConfig
            label="Bouldering"
            range={ranges.bouldering}
            onStep={(b, d) => step('bouldering', b, d)}
          />
          <RangeConfig label="Top rope" range={ranges.top_rope} onStep={(b, d) => step('top_rope', b, d)} />
          <RangeConfig label="Lead" range={ranges.lead} onStep={(b, d) => step('lead', b, d)} />

          {/* Areas / sections (A69) */}
          <div className="space-y-2">
            <p className="px-1 text-xs text-muted-foreground">Areas</p>
            <div className="flex gap-2">
              <Input
                value={newArea}
                placeholder="Add an area (e.g. Cave)"
                onChange={(e) => setNewArea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addArea()
                }}
              />
              <Button onClick={addArea} disabled={!newArea.trim()}>
                Add area
              </Button>
            </div>
            {areas.map((a) => (
              <AreaRow
                key={a.name}
                area={a}
                onRename={(next) => gym != null && setAreas(renameGymArea(gym, a.name, next))}
                onDelete={() => gym != null && setAreas(removeGymArea(gym, a.name))}
                onSetDefaults={(patch) =>
                  gym != null && setAreas(updateGymAreaDefaults(gym, a.name, patch))
                }
              />
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Delete gym
          </Button>
        </div>
        <div className="border-t border-border p-4">
          <Button className="w-full" onClick={save}>
            Save
          </Button>
        </div>
      </SheetContent>

      {/* F42 — deleting a saved gym only clears its saved-list entry and local
          config; sessions/routes recorded there keep their gym name. */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{gym}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {gym} from your saved list. Your climb history at this location will not
              be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

// One editable gym-area row (A69): inline rename on blur, plus delete.
// One gym area (A69) with its optional default height + wall character (A83).
function AreaRow({
  area,
  onRename,
  onDelete,
  onSetDefaults,
}: {
  area: GymArea
  onRename: (next: string) => void
  onDelete: () => void
  onSetDefaults: (
    patch: Partial<
      Pick<GymArea, 'defaultHeightMetres' | 'defaultCharacter' | 'defaultAngleDegrees'>
    >,
  ) => void
}) {
  const [draft, setDraft] = useState(area.name)
  const [height, setHeight] = useState(
    area.defaultHeightMetres != null ? String(area.defaultHeightMetres) : '',
  )
  const [angle, setAngle] = useState(
    area.defaultAngleDegrees != null ? String(area.defaultAngleDegrees) : '',
  )
  useEffect(() => {
    setDraft(area.name)
    setHeight(area.defaultHeightMetres != null ? String(area.defaultHeightMetres) : '')
    setAngle(area.defaultAngleDegrees != null ? String(area.defaultAngleDegrees) : '')
  }, [area.name, area.defaultHeightMetres, area.defaultAngleDegrees])

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          aria-label={`Area ${area.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = draft.trim()
            if (n && n !== area.name) onRename(n)
            else setDraft(area.name)
          }}
        />
        <button
          type="button"
          aria-label={`Delete area ${area.name}`}
          // Keep the input from blurring first (which would rename, leaving this
          // delete to no-op on the stale name).
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Default height (m)</span>
        <Input
          inputMode="decimal"
          value={height}
          placeholder="optional"
          onChange={(e) => {
            // Strip non-numeric chars and keep only the first decimal point so a
            // fat-fingered "1.2.3" can't parse to NaN and silently drop the value.
            const raw = e.target.value.replace(/[^0-9.]/g, '')
            const i = raw.indexOf('.')
            setHeight(i === -1 ? raw : raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, ''))
          }}
          onBlur={() => {
            const n = height.trim() === '' ? undefined : Number(height)
            onSetDefaults({ defaultHeightMetres: n != null && !Number.isNaN(n) ? n : undefined })
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Default angle (°)</span>
        <Input
          inputMode="numeric"
          value={angle}
          placeholder="optional"
          onChange={(e) => setAngle(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            const n = angle.trim() === '' ? undefined : Number(angle)
            const clamped =
              n != null && !Number.isNaN(n) ? Math.max(0, Math.min(90, Math.round(n))) : undefined
            onSetDefaults({ defaultAngleDegrees: clamped })
            setAngle(clamped != null ? String(clamped) : '')
          }}
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Default character</span>
        <div className="flex flex-wrap gap-2">
          {CLIMB_CHARACTERS.map((c) => (
            <SelectPill
              key={c.value}
              label={c.label}
              active={area.defaultCharacter === c.value}
              onClick={() =>
                onSetDefaults({
                  defaultCharacter: area.defaultCharacter === c.value ? undefined : c.value,
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// A min/max grade-range configurator (A21). Both bounds use hold-to-repeat
// steppers, matching the wall-angle input (A6).
function RangeConfig({
  label,
  range,
  onStep,
}: {
  label: string
  range: GradeRange
  onStep: (bound: 'min' | 'max', delta: number) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex gap-3">
        <Stepper label="Min" value={range.min} onStep={(d) => onStep('min', d)} />
        <Stepper label="Max" value={range.max} onStep={(d) => onStep('max', d)} />
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  onStep,
}: {
  label: string
  value: number
  onStep: (delta: number) => void
}) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <HoldButton aria-label={`Decrease ${label}`} onStep={() => onStep(-1)}>
          <Minus className="size-4" />
        </HoldButton>
        <span className="min-w-8 flex-1 text-center text-lg font-semibold tabular-nums">{value}</span>
        <HoldButton aria-label={`Increase ${label}`} onStep={() => onStep(1)}>
          <Plus className="size-4" />
        </HoldButton>
      </div>
    </div>
  )
}

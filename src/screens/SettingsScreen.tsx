import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronRight,
  Combine,
  Download,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { clearAllData, exportAllData, importAllData, mergeData } from '@/db/helpers'
import { restoreDefaults } from '@/db/seed'
import { getUserName, setUserName } from '@/lib/userName'
import { getBodyweight, setBodyweight } from '@/lib/bodyweight'
import {
  BUILTIN_ROUTE_COLOURS,
  addCustomRouteColour,
  colourNameTaken,
  getCustomRouteColours,
  removeCustomRouteColour,
} from '@/lib/routeColours'
import { NumberStepper } from '@/components/NumberStepper'
import { THEMES, THEME_PREVIEWS, applyTheme, getTheme } from '@/lib/theme'
import {
  addCustomClimbStyle,
  addGymArea,
  clearDefaultLocation,
  deleteBoard,
  deleteGym,
  getAutoAdvance,
  getConfettiEnabled,
  getCustomClimbStyles,
  getDefaultLocation,
  getGymAreaList,
  getGymGradeRanges,
  getKeepAwake,
  getPrecountSeconds,
  getSavedLocations,
  getTickDisplayStyle,
  getTimerSounds,
  getWeekStart,
  getWeightIncrement,
  getWeightIncrementEnabled,
  rememberLocation,
  removeCustomClimbStyle,
  removeGymArea,
  renameGym,
  renameGymArea,
  updateGymAreaDefaults,
  setAutoAdvance,
  setConfettiEnabled,
  setDefaultLocation,
  setPrecountSeconds,
  setTickDisplayStyle,
  setGymGradeRanges,
  setKeepAwake,
  setTimerSounds,
  setWeekStart,
  setWeightIncrement,
  setWeightIncrementEnabled,
  DEFAULT_WEIGHT_STEP,
  type DefaultLocationType,
  type GradeRange,
  type GymArea,
  type GymGradeRanges,
  type GymStyle,
} from '@/lib/prefs'
import { CLIMB_CHARACTERS } from '@/lib/climbing'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SelectPill } from '@/components/SelectPill'
import { HoldButton } from '@/components/HoldButton'
import { TagManager } from '@/components/TagManager'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
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
const REPO_URL = 'https://github.com/laidlaw42/workout_tracker'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const mergeFileRef = useRef<HTMLInputElement>(null)
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClear2, setConfirmClear2] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [gyms, setGyms] = useState(() => getSavedLocations('gym'))
  const [newGym, setNewGym] = useState('')
  const [editGym, setEditGym] = useState<string | null>(null)
  const [boards, setBoards] = useState(() => getSavedLocations('board'))
  const [newBoard, setNewBoard] = useState('')
  const [name, setName] = useState(getUserName())
  const [bwInput, setBwInput] = useState(() => {
    const bw = getBodyweight()
    return bw != null ? String(bw) : ''
  })
  const [theme, setTheme] = useState(getTheme())
  const [autoAdvance, setAutoAdvanceState] = useState(getAutoAdvance())
  const [timerSounds, setTimerSoundsState] = useState(getTimerSounds())
  const [keepAwake, setKeepAwakeState] = useState(getKeepAwake())
  const [confettiOn, setConfettiOnState] = useState(getConfettiEnabled())
  const [tickStyle, setTickStyleState] = useState(getTickDisplayStyle())
  const [customColours, setCustomColours] = useState(getCustomRouteColours())
  const [newColourName, setNewColourName] = useState('')
  const [newColourHex, setNewColourHex] = useState('#3b82f6')
  const [colourError, setColourError] = useState('')
  const [weekStart, setWeekStartState] = useState<'mon' | 'sun'>(getWeekStart() === 0 ? 'sun' : 'mon')
  const [precount, setPrecount] = useState(getPrecountSeconds)
  const [weightIncOn, setWeightIncOn] = useState(getWeightIncrementEnabled())
  const [weightInc, setWeightInc] = useState(() => String(getWeightIncrement()))

  useEffect(() => {
    setPrecountSeconds(precount)
  }, [precount])

  function stepPrecount(delta: number) {
    setPrecount((cur) => Math.max(0, Math.min(10, cur + delta)))
  }

  async function handleExport() {
    try {
      const json = await exportAllData()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workout-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await importAllData(await file.text())
      toast.success('Data imported')
    } catch {
      toast.error('Import failed — is this a valid backup file?')
    }
  }

  async function handleMergeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { inserted, skipped } = await mergeData(await file.text())
      toast.success(`Merge complete — ${inserted} records added, ${skipped} already existed`)
    } catch {
      toast.error('Merge failed — is this a valid backup file?')
    }
  }

  async function handleClearAll() {
    try {
      await clearAllData()
      setConfirmClear2(false)
      toast.success('All data cleared')
      navigate('/home')
    } catch {
      toast.error('Could not clear data')
    }
  }

  async function handleRestoreDefaults() {
    try {
      await restoreDefaults()
      setConfirmRestore(false)
      toast.success('Defaults restored')
    } catch {
      toast.error('Could not restore defaults')
    }
  }

  function handleAddGym() {
    rememberLocation('gym', newGym)
    setGyms(getSavedLocations('gym'))
    setNewGym('')
  }

  function handleAddBoard() {
    const n = newBoard.trim()
    if (!n) return
    rememberLocation('board', n)
    setBoards(getSavedLocations('board'))
    setNewBoard('')
  }
  function handleDeleteBoard(name: string) {
    setBoards(deleteBoard(name))
  }

  function handleAddColour() {
    const name = newColourName.trim()
    if (!name) return
    if (colourNameTaken(name)) {
      setColourError('That colour name already exists.')
      return
    }
    addCustomRouteColour(name, newColourHex)
    setCustomColours(getCustomRouteColours())
    setNewColourName('')
    setColourError('')
  }

  function handleRemoveColour(name: string) {
    removeCustomRouteColour(name)
    setCustomColours(getCustomRouteColours())
  }

  return (
    <div className="min-h-dvh">
      <PageHeader title="Settings" onBack={() => navigate('/home')} />
      <div className="space-y-6 p-4">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">You</h2>
          <Label htmlFor="user-name">Name</Label>
          <Input
            id="user-name"
            value={name}
            placeholder="optional"
            onChange={(e) => {
              setName(e.target.value)
              setUserName(e.target.value)
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">Used in your home greeting.</p>
          <Label htmlFor="user-bw">Bodyweight (kg)</Label>
          <NumberStepper
            value={bwInput}
            ariaLabel="bodyweight"
            step={0.5}
            min={0}
            inputMode="decimal"
            placeholder="optional"
            onChange={(v) => {
              setBwInput(v)
              setBodyweight(v.trim() === '' ? null : Number(v))
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">
            Shows effort as a % of bodyweight on session weight inputs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Theme</h2>
          <Select
            value={theme}
            onValueChange={(id) => {
              applyTheme(id) // updates data-theme on <html> + saves to localStorage
              setTheme(id)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <ThemeSwatch id={t.id} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="px-1 text-xs text-muted-foreground">Applies instantly — pick to preview.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Session</h2>
          <div className="space-y-2">
            <SettingSwitch
              label="Auto-start next timed set"
              description="When a rest timer ends, automatically begin the next hang/hold countdown."
              checked={autoAdvance}
              onChange={(v) => {
                setAutoAdvance(v)
                setAutoAdvanceState(v)
              }}
            />
            <SettingSwitch
              label="Timer sounds"
              description="Play countdown beeps and a completion tone for the set and rest timers."
              checked={timerSounds}
              onChange={(v) => {
                setTimerSounds(v)
                setTimerSoundsState(v)
              }}
            />
            <SettingSwitch
              label="Keep screen awake"
              description="Stop the screen sleeping during an active workout."
              checked={keepAwake}
              onChange={(v) => {
                setKeepAwake(v)
                setKeepAwakeState(v)
              }}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Workout</h2>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Exercise pre-count</p>
              <p className="text-xs text-muted-foreground">
                A “Get ready” countdown before timed exercises. 0 turns it off.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <HoldButton aria-label="Decrease pre-count" onStep={() => stepPrecount(-1)}>
                <Minus className="size-4" />
              </HoldButton>
              <span className="min-w-6 text-center text-lg font-semibold tabular-nums">{precount}</span>
              <HoldButton aria-label="Increase pre-count" onStep={() => stepPrecount(1)}>
                <Plus className="size-4" />
              </HoldButton>
            </div>
          </div>
          <SettingSwitch
            label="Weight increment"
            description={`Custom step for the +/− buttons on session weight inputs. Off uses ${DEFAULT_WEIGHT_STEP} kg.`}
            checked={weightIncOn}
            onChange={(v) => {
              setWeightIncrementEnabled(v)
              setWeightIncOn(v)
            }}
          >
            {weightIncOn && (
              <div className="space-y-2">
                <Label htmlFor="weight-increment">Increment (kg)</Label>
                <Input
                  id="weight-increment"
                  inputMode="decimal"
                  value={weightInc}
                  placeholder="e.g. 2.5"
                  onChange={(e) => {
                    // Positive number, up to two decimals; persist when valid.
                    let v = e.target.value.replace(/[^0-9.]/g, '')
                    const dot = v.indexOf('.')
                    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2)
                    setWeightInc(v)
                    const n = Number(v)
                    if (Number.isFinite(n) && n > 0) setWeightIncrement(n)
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {[0.25, 0.5, 1, 2, 5, 10, 15].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setWeightInc(String(p))
                        setWeightIncrement(p)
                      }}
                      className="min-w-11 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors active:bg-accent"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SettingSwitch>
          <SettingSwitch
            label="Celebration confetti"
            description="Shown when a workout is completed."
            checked={confettiOn}
            onChange={(v) => {
              setConfettiEnabled(v)
              setConfettiOnState(v)
            }}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Calendar</h2>
          <Label>Week starts on</Label>
          <SegmentedControl
            options={[
              { value: 'mon', label: 'Monday' },
              { value: 'sun', label: 'Sunday' },
            ]}
            value={weekStart}
            onChange={(v) => {
              setWeekStart(v === 'sun' ? 0 : 1)
              setWeekStartState(v)
            }}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Climbing</h2>
          <Label>Tick indicators</Label>
          <SegmentedControl
            options={[
              { value: 'emojis', label: 'Emojis' },
              { value: 'symbols', label: 'Symbols' },
            ]}
            value={tickStyle}
            onChange={(v) => {
              setTickDisplayStyle(v)
              setTickStyleState(v)
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">
            Shown next to each tick type on route cards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Route colours</h2>
          <p className="px-1 text-xs text-muted-foreground">
            Gym tape colours for logging routes. Built-ins can't be removed.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_ROUTE_COLOURS.map((c) => (
              <span
                key={c.value}
                title={c.label}
                className="size-6 rounded-full border border-border opacity-70"
                style={{ background: c.swatch }}
              />
            ))}
          </div>
          {customColours.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {customColours.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                >
                  <span
                    className="size-6 shrink-0 rounded-full border border-border"
                    style={{ background: c.hex }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => handleRemoveColour(c.name)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <input
              type="color"
              aria-label="Custom colour"
              value={newColourHex}
              onChange={(e) => setNewColourHex(e.target.value)}
              className="h-9 w-12 shrink-0 rounded-md border border-border bg-transparent"
            />
            <Input
              value={newColourName}
              placeholder="Colour name"
              onChange={(e) => {
                setNewColourName(e.target.value)
                setColourError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColour()
              }}
            />
            <Button onClick={handleAddColour} disabled={!newColourName.trim()}>
              Add colour
            </Button>
          </div>
          {colourError && <p className="px-1 text-xs text-destructive">{colourError}</p>}
        </section>

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
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Boards</h2>
          <div className="flex gap-2">
            <Input
              value={newBoard}
              placeholder="Add a board"
              onChange={(e) => setNewBoard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddBoard()
              }}
            />
            <Button onClick={handleAddBoard} disabled={!newBoard.trim()}>
              Add board
            </Button>
          </div>
          {boards.length > 0 ? (
            <div className="space-y-2">
              {boards.map((b) => (
                <div
                  key={b}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{b}</span>
                  <button
                    type="button"
                    aria-label={`Delete board ${b}`}
                    onClick={() => handleDeleteBoard(b)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">
              Boards you train on are saved here for quick selection. Removing one won’t affect
              logged sessions.
            </p>
          )}
          {/* A51 — a saved default skips the name prompt on session start. */}
          <div className="pt-2">
            <DefaultLocationRow type="board" label="Default board" />
          </div>
        </section>

        <ClimbStylesManager />

        <TagManager />

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Data</h2>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={handleExport}>
              <Download className="size-4" /> Export data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setConfirmImport(true)}
            >
              <Upload className="size-4" /> Import data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => mergeFileRef.current?.click()}
            >
              <Combine className="size-4" /> Import and merge
            </Button>
            <p className="px-1 text-xs text-muted-foreground">
              Export downloads a JSON backup. Import replaces all current data; merge adds only
              records not already on this device.
            </p>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setConfirmRestore(true)}
            >
              <RotateCcw className="size-4" /> Restore defaults
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-4" /> Clear all data
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">About</h2>
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            <p className="font-medium">Workout Tracker</p>
            <p className="text-muted-foreground">Version {import.meta.env.VITE_APP_VERSION}</p>
            <p className="text-muted-foreground">Made with love for Britta ❤</p>
            <p className="mt-1 text-muted-foreground">
              Offline-first. Data stays on this device. Zero telemetry. No in-app purchases.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
            >
              Source on GitHub
            </a>
          </div>
        </section>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFile}
      />
      <input
        ref={mergeFileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleMergeFile}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your workouts, sessions, history, and planned
              workouts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClear(false)
                setConfirmClear2(true)
              }}
            >
              Clear data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear2} onOpenChange={setConfirmClear2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure? This is permanent.</AlertDialogTitle>
            <AlertDialogDescription>
              Every workout, session, record, and planned workout will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAll}
            >
              Yes, delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the original exercise library and workout templates. Any exercises
              or templates you have created or edited will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDefaults}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all workouts, templates, and records currently on this device.
              Consider exporting first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fileRef.current?.click()}>
              Choose file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GymEditSheet
        gym={editGym}
        onClose={() => setEditGym(null)}
        onChanged={() => setGyms(getSavedLocations('gym'))}
      />
    </div>
  )
}

// One default-location row (A51): shows the saved default gym/board, with Change
// (set a new one) and Remove default (revert to always prompting).
function DefaultLocationRow({ type, label }: { type: DefaultLocationType; label: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [, bump] = useReducer((n: number) => n + 1, 0)
  // Read on every render so a parent re-render (e.g. after a gym rename/delete
  // that touches the default) reflects the current value without going stale.
  const value = getDefaultLocation(type)
  const saved = getSavedLocations(type)

  function save() {
    setDefaultLocation(type, draft)
    setEditing(false)
    bump()
  }
  function remove() {
    clearDefaultLocation(type)
    setEditing(false)
    bump()
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {value || 'Not set — you’ll be asked each time'}
          </p>
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(value)
                setEditing(true)
              }}
            >
              {value ? 'Change' : 'Set default'}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={remove}>
                Remove default
              </Button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <div className="space-y-2">
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft(s)}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors active:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <Input
            value={draft}
            placeholder={`Default ${type} name`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
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

// Settings section for user-defined climb styles (A72).
function ClimbStylesManager() {
  const [styles, setStyles] = useState<string[]>(() => getCustomClimbStyles())
  const [newStyle, setNewStyle] = useState('')
  const [toDelete, setToDelete] = useState<string | null>(null)

  function add() {
    const n = newStyle.trim()
    if (!n) return
    setStyles(addCustomClimbStyle(n))
    setNewStyle('')
  }
  function confirmDelete() {
    if (toDelete == null) return
    setStyles(removeCustomClimbStyle(toDelete))
    setToDelete(null)
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Climb styles</h2>
      <p className="px-1 text-xs text-muted-foreground">
        Custom style tags, shown after the built-in ones when logging a route.
      </p>
      <div className="flex gap-2">
        <Input
          value={newStyle}
          placeholder="Add a style"
          onChange={(e) => setNewStyle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <Button onClick={add} disabled={!newStyle.trim()}>
          Add style
        </Button>
      </div>
      {styles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {styles.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs"
            >
              {s}
              <button
                type="button"
                aria-label={`Delete style ${s}`}
                onClick={() => setToDelete(s)}
                className="text-muted-foreground transition-colors active:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It’s removed from the style list. Routes already tagged with it keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// Three 12px circles (background / primary / accent) previewing a theme (A28).
function ThemeSwatch({ id }: { id: string }) {
  const preview = THEME_PREVIEWS[id]
  if (!preview) return null
  return (
    <span className="flex items-center gap-1">
      {preview.map((c, i) => (
        <span
          key={i}
          className="size-3 rounded-full border border-border/60"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  )
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Optional expandable content rendered beneath the row (e.g. when enabled). */
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            checked ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              // Anchor at left-0.5 (2px) and slide with translate; without an
              // explicit left the abspos thumb resolved to the right edge and
              // overhung the track.
              'absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>
      {children}
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

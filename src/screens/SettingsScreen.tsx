import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { DataToolsSection } from '@/components/settings/DataToolsSection'
import { GymManager } from '@/components/settings/GymManager'
import { BoardManager } from '@/components/settings/BoardManager'
import { SessionPrefsSection } from '@/components/settings/SessionPrefsSection'
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
  getCustomClimbStyles,
  getPlannerView,
  getTickDisplayStyle,
  getWeekStart,
  removeCustomClimbStyle,
  setPlannerView,
  setTickDisplayStyle,
  setWeekStart,
  type PlannerView,
} from '@/lib/prefs'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TagManager } from '@/components/TagManager'
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
  const [name, setName] = useState(getUserName())
  const [bwInput, setBwInput] = useState(() => {
    const bw = getBodyweight()
    return bw != null ? String(bw) : ''
  })
  const [theme, setTheme] = useState(getTheme())
  const [tickStyle, setTickStyleState] = useState(getTickDisplayStyle())
  const [customColours, setCustomColours] = useState(getCustomRouteColours())
  const [newColourName, setNewColourName] = useState('')
  const [newColourHex, setNewColourHex] = useState('#3b82f6')
  const [colourError, setColourError] = useState('')
  const [weekStart, setWeekStartState] = useState<'mon' | 'sun'>(getWeekStart() === 0 ? 'sun' : 'mon')
  const [plannerView, setPlannerViewState] = useState<PlannerView>(getPlannerView)

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

        <SessionPrefsSection />

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
          <Label>Default view</Label>
          <SegmentedControl
            options={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'list', label: 'List' },
            ]}
            value={plannerView}
            onChange={(v) => {
              setPlannerView(v)
              setPlannerViewState(v)
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">Which view the planner opens on.</p>
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

        <GymManager />

        <BoardManager />

        <ClimbStylesManager />

        <TagManager />

        <DataToolsSection />

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

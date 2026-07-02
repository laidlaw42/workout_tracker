import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Combine, Download, Trash2, Upload } from 'lucide-react'
import { clearAllData, exportAllData, importAllData, mergeData } from '@/db/helpers'
import { getUserName, setUserName } from '@/lib/userName'
import { THEMES, applyTheme, getTheme } from '@/lib/theme'
import {
  getAutoAdvance,
  getKeepAwake,
  getTimerSounds,
  getWeekStart,
  setAutoAdvance,
  setKeepAwake,
  setTimerSounds,
  setWeekStart,
} from '@/lib/prefs'
import { SegmentedControl } from '@/components/SegmentedControl'
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
  const [name, setName] = useState(getUserName())
  const [theme, setTheme] = useState(getTheme())
  const [autoAdvance, setAutoAdvanceState] = useState(getAutoAdvance())
  const [timerSounds, setTimerSoundsState] = useState(getTimerSounds())
  const [keepAwake, setKeepAwakeState] = useState(getKeepAwake())
  const [weekStart, setWeekStartState] = useState<'mon' | 'sun'>(getWeekStart() === 0 ? 'sun' : 'mon')

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
                  {t.label}
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
            <p className="text-muted-foreground">Made with love for Britta ❤️</p>
            <p className="mt-1 text-muted-foreground">
              Offline-first. Weights in kg. Your data stays on this device.
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
    </div>
  )
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
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
            'absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

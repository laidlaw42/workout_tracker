import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  getAutoAdvance,
  getConfettiEnabled,
  getKeepAwake,
  getPrecountSeconds,
  getTimerSounds,
  getWeightIncrement,
  getWeightIncrementEnabled,
  setAutoAdvance,
  setConfettiEnabled,
  setKeepAwake,
  setPrecountSeconds,
  setTimerSounds,
  setWeightIncrement,
  setWeightIncrementEnabled,
  DEFAULT_WEIGHT_STEP,
} from '@/lib/prefs'
import { HoldButton } from '@/components/HoldButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// The "Session" and "Workout" preference groups: auto-advance / timer sounds /
// keep-awake toggles, the exercise pre-count stepper, the weight-increment
// override and the celebration-confetti toggle. Each control persists on change
// and mirrors into local state so the row reflects it immediately.
export function SessionPrefsSection() {
  const [autoAdvance, setAutoAdvanceState] = useState(getAutoAdvance())
  const [timerSounds, setTimerSoundsState] = useState(getTimerSounds())
  const [keepAwake, setKeepAwakeState] = useState(getKeepAwake())
  const [confettiOn, setConfettiOnState] = useState(getConfettiEnabled())
  const [precount, setPrecount] = useState(getPrecountSeconds)
  const [weightIncOn, setWeightIncOn] = useState(getWeightIncrementEnabled())
  const [weightInc, setWeightInc] = useState(() => String(getWeightIncrement()))

  useEffect(() => {
    setPrecountSeconds(precount)
  }, [precount])

  function stepPrecount(delta: number) {
    setPrecount((cur) => Math.max(0, Math.min(10, cur + delta)))
  }

  return (
    <>
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
    </>
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
        <Switch checked={checked} ariaLabel={label} onChange={onChange} />
      </div>
      {children}
    </div>
  )
}

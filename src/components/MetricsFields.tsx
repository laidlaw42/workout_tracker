import { NumberStepper } from '@/components/NumberStepper'
import { getWeightStep } from '@/lib/prefs'
import { METRIC_LABEL, METRIC_ORDER, exerciseMetrics } from '@/lib/metrics'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Exercise, ExerciseDefaults, ExerciseMetric } from '@/types'

// The "Parameters" section of the exercise editor: one toggle per metric (Sets …
// Load, in canonical order), each revealing a −/+ stepper (also text-editable) for
// its default value. The enabled toggles are the exercise's `metrics`; the values
// are its `defaults`. The set row surfaces exactly the enabled metrics.

export type MetricsDraft = Record<ExerciseMetric, { on: boolean; value: string }>

// Which ExerciseDefaults field holds each metric's default value.
const METRIC_FIELD: Record<ExerciseMetric, keyof ExerciseDefaults> = {
  sets: 'sets',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceKm',
  rest: 'restSeconds',
  edge: 'edgeDepthMm',
  weight: 'weightKg',
  load: 'loadKg',
}

// A brand-new exercise starts as a typical strength lift; the user toggles from there.
const NEW_METRICS: ExerciseMetric[] = ['sets', 'reps', 'rest', 'weight']

// Per-metric stepper config (bounds / step / placeholder). Load allows negatives
// (assisted); weight/load/distance take decimals.
function metricUi(m: ExerciseMetric): {
  min?: number
  step?: number
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
} {
  switch (m) {
    case 'sets':
      return { min: 1, placeholder: '3' }
    case 'reps':
      return { min: 0, placeholder: '10' }
    case 'duration':
      return { min: 1, placeholder: '30' }
    case 'distance':
      return { min: 0, step: 0.5, inputMode: 'decimal', placeholder: '5' }
    case 'rest':
      return { min: 0, step: 5, placeholder: '90' }
    case 'edge':
      return { min: 1, placeholder: '20' }
    case 'weight':
      return { min: 0, step: getWeightStep(), inputMode: 'decimal', placeholder: 'optional' }
    case 'load':
      return { min: -999, step: getWeightStep(), inputMode: 'decimal', placeholder: '0' }
  }
}

const num = (v: string) => {
  const n = Number(v)
  return v.trim() === '' || Number.isNaN(n) ? undefined : n
}

export function emptyMetricsDraft(): MetricsDraft {
  return Object.fromEntries(
    METRIC_ORDER.map((m) => [m, { on: false, value: '' }]),
  ) as MetricsDraft
}

// Seed a draft from a saved exercise (edit) or the new-exercise defaults (create).
export function exerciseToMetricsDraft(ex?: Exercise | null): MetricsDraft {
  const enabled = ex ? exerciseMetrics(ex) : NEW_METRICS
  const draft = emptyMetricsDraft()
  for (const m of METRIC_ORDER) {
    const v = ex?.defaults?.[METRIC_FIELD[m]]
    draft[m] = { on: enabled.includes(m), value: v != null ? String(v) : '' }
  }
  return draft
}

// Draft → the enabled metrics + their default values (undefined when none are set).
export function metricsDraftToStored(draft: MetricsDraft): {
  metrics: ExerciseMetric[]
  defaults?: ExerciseDefaults
} {
  const metrics = METRIC_ORDER.filter((m) => draft[m].on)
  const defaults: ExerciseDefaults = {}
  for (const m of metrics) {
    const n = num(draft[m].value)
    if (n != null) defaults[METRIC_FIELD[m]] = n
  }
  return { metrics, defaults: Object.keys(defaults).length > 0 ? defaults : undefined }
}

interface Props {
  value: MetricsDraft
  onChange: (next: MetricsDraft) => void
}

export function MetricsFields({ value, onChange }: Props) {
  const set = (m: ExerciseMetric, patch: Partial<{ on: boolean; value: string }>) =>
    onChange({ ...value, [m]: { ...value[m], ...patch } })
  return (
    <div className="space-y-2">
      <Label>Parameters</Label>
      <p className="text-xs text-muted-foreground">
        Toggle the metrics this exercise tracks; set a default for each.
      </p>
      <div className="space-y-2">
        {METRIC_ORDER.map((m) => {
          const { on, value: v } = value[m]
          const ui = metricUi(m)
          return (
            <div
              key={m}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{METRIC_LABEL[m]}</span>
              {on && (
                <div className="w-36 shrink-0">
                  <NumberStepper
                    value={v}
                    ariaLabel={`default ${m}`}
                    min={ui.min}
                    step={ui.step}
                    inputMode={ui.inputMode}
                    placeholder={ui.placeholder}
                    onChange={(nv) => set(m, { value: nv })}
                  />
                </div>
              )}
              <Switch checked={on} ariaLabel={METRIC_LABEL[m]} onChange={(c) => set(m, { on: c })} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { NumberStepper } from '@/components/NumberStepper'
import { getWeightStep } from '@/lib/prefs'
import { Label } from '@/components/ui/label'
import type { ExerciseDefaults, TrackingType } from '@/types'

// A98 — the "Default parameters" section, shared by the full exercise editor
// (ExerciseFormSheet) and the picker's inline quick-create (ExercisePicker) so
// both offer the same fields. Values are held as strings by the caller (blank =
// unset). Which fields show follows the tracking type.

export interface DefaultsDraft {
  sets: string
  reps: string
  weight: string
  duration: string
  distance: string
  rest: string
  edge: string
}

export const EMPTY_DEFAULTS: DefaultsDraft = {
  sets: '',
  reps: '',
  weight: '',
  duration: '',
  distance: '',
  rest: '',
  edge: '',
}

// Seed a draft from a saved ExerciseDefaults record.
export function defaultsToDraft(d?: ExerciseDefaults): DefaultsDraft {
  const s = (n?: number) => (n != null ? String(n) : '')
  return {
    sets: s(d?.sets),
    reps: s(d?.reps),
    weight: s(d?.weightKg),
    duration: s(d?.durationSeconds),
    distance: s(d?.distanceKm),
    rest: s(d?.restSeconds),
    edge: s(d?.edgeDepthMm),
  }
}

// Build an ExerciseDefaults from the draft + tracking type. Keeps only the fields
// relevant to the tracking type; returns undefined when nothing is set (so an
// exercise with no defaults stays clean and uses the hardcoded add fallbacks).
export function draftToDefaults(
  tracking: TrackingType,
  d: DefaultsDraft,
): ExerciseDefaults | undefined {
  const num = (v: string) => {
    const n = Number(v)
    return v.trim() === '' || Number.isNaN(n) ? undefined : n
  }
  const draft: ExerciseDefaults = {
    sets: num(d.sets),
    restSeconds: num(d.rest),
    reps: tracking === 'reps' ? num(d.reps) : undefined,
    weightKg: tracking === 'reps' ? num(d.weight) : undefined,
    durationSeconds: tracking === 'duration' ? num(d.duration) : undefined,
    distanceKm: tracking === 'distance' ? num(d.distance) : undefined,
    // Edge only shows for hangboard grips; blank elsewhere, so it drops out.
    edgeDepthMm: tracking === 'duration' ? num(d.edge) : undefined,
  }
  return Object.values(draft).some((v) => v != null) ? draft : undefined
}

interface Props {
  tracking: TrackingType
  value: DefaultsDraft
  onChange: (patch: Partial<DefaultsDraft>) => void
  /** Show the edge-depth default (hangboard grips — duration + edge tracking). */
  edge?: boolean
}

export function ExerciseDefaultsFields({ tracking, value, onChange, edge = false }: Props) {
  return (
    <div className="space-y-2">
      <Label>Default parameters</Label>
      <p className="text-xs text-muted-foreground">
        Pre-filled when this exercise is added to a workout. Leave blank for the standard defaults.
      </p>
      <div className="space-y-2 rounded-lg border border-border p-3">
        <Field label="Sets">
          <NumberStepper
            value={value.sets}
            onChange={(v) => onChange({ sets: v })}
            ariaLabel="default sets"
            min={1}
            placeholder="3"
          />
        </Field>
        {tracking === 'reps' && (
          <>
            <Field label="Reps">
              <NumberStepper
                value={value.reps}
                onChange={(v) => onChange({ reps: v })}
                ariaLabel="default reps"
                min={0}
                placeholder="10"
              />
            </Field>
            <Field label="Weight (kg)">
              <NumberStepper
                value={value.weight}
                onChange={(v) => onChange({ weight: v })}
                ariaLabel="default weight"
                step={getWeightStep()}
                min={0}
                inputMode="decimal"
                placeholder="optional"
              />
            </Field>
          </>
        )}
        {tracking === 'duration' && (
          <Field label="Duration (s)">
            <NumberStepper
              value={value.duration}
              onChange={(v) => onChange({ duration: v })}
              ariaLabel="default duration"
              min={1}
              placeholder="30"
            />
          </Field>
        )}
        {tracking === 'duration' && edge && (
          <Field label="Edge (mm)">
            <NumberStepper
              value={value.edge}
              onChange={(v) => onChange({ edge: v })}
              ariaLabel="default edge depth"
              min={1}
              placeholder="20"
            />
          </Field>
        )}
        {tracking === 'distance' && (
          <Field label="Distance (km)">
            <NumberStepper
              value={value.distance}
              onChange={(v) => onChange({ distance: v })}
              ariaLabel="default distance"
              step={0.5}
              min={0}
              inputMode="decimal"
              placeholder="optional"
            />
          </Field>
        )}
        <Field label="Rest (s)">
          <NumberStepper
            value={value.rest}
            onChange={(v) => onChange({ rest: v })}
            ariaLabel="default rest"
            step={5}
            min={0}
            placeholder="90"
          />
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

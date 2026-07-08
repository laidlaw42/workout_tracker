import { SegmentedControl } from '@/components/SegmentedControl'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Exercise, TrackingType, WeightLabel } from '@/types'

// F51 — the editable tracking configuration for an exercise: which metrics its set
// row surfaces. Held as a plain draft by the form; draft ↔ stored conversion lives
// here so any caller stays consistent. No field is locked or inferred from
// category/name — the user has full control over every combination.

export interface TrackingConfigDraft {
  hasWeight: boolean
  weightLabel: WeightLabel
  isBodyweight: boolean
  supportsNegativeLoad: boolean
  hasIntraRest: boolean
  hasEdgeDepth: boolean
}

export const DEFAULT_TRACKING_CONFIG: TrackingConfigDraft = {
  hasWeight: true,
  weightLabel: 'weight',
  isBodyweight: false,
  supportsNegativeLoad: false,
  hasIntraRest: false,
  hasEdgeDepth: false,
}

// Seed a draft from a saved exercise (edit), else the standard defaults (create).
export function configToDraft(e?: Exercise | null): TrackingConfigDraft {
  if (!e) return DEFAULT_TRACKING_CONFIG
  return {
    hasWeight: e.hasWeight ?? true,
    weightLabel: e.weightLabel ?? 'weight',
    isBodyweight: e.isBodyweight ?? false,
    supportsNegativeLoad: e.supportsNegativeLoad ?? false,
    hasIntraRest: e.hasIntraRest ?? false,
    hasEdgeDepth: e.hasEdgeDepth ?? false,
  }
}

type StoredConfig = Pick<
  Exercise,
  'hasWeight' | 'weightLabel' | 'isBodyweight' | 'supportsNegativeLoad' | 'hasIntraRest' | 'hasEdgeDepth'
>

// Normalise a draft into the six stored fields for a tracking type, applying F51's
// visibility semantics: a control that isn't shown resolves to its inert value.
export function draftToConfig(tracking: TrackingType, d: TrackingConfigDraft): StoredConfig {
  const hasWeight = d.hasWeight
  const weightLabel: WeightLabel = hasWeight ? d.weightLabel : 'weight'
  const isBodyweight = hasWeight && weightLabel === 'added_load' ? d.isBodyweight : false
  const supportsNegativeLoad = !hasWeight
    ? false
    : weightLabel === 'added_load'
      ? isBodyweight // a bodyweight move can be assisted (negative load)
      : weightLabel === 'load'
        ? d.supportsNegativeLoad
        : false
  return {
    hasWeight,
    weightLabel,
    isBodyweight,
    supportsNegativeLoad,
    hasIntraRest: tracking === 'duration' ? d.hasIntraRest : false,
    hasEdgeDepth: d.hasEdgeDepth,
  }
}

const WEIGHT_LABEL_OPTIONS: { value: WeightLabel; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'added_load', label: 'Added load' },
  { value: 'load', label: 'Load' },
]

interface Props {
  tracking: TrackingType
  value: TrackingConfigDraft
  onChange: (patch: Partial<TrackingConfigDraft>) => void
}

export function TrackingOptionsFields({ tracking, value: c, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Tracking options</Label>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <Toggle
          label="Track weight or load"
          description="Show a weight/load input on the set row."
          checked={c.hasWeight}
          onChange={(v) => onChange({ hasWeight: v })}
        />
        {c.hasWeight && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Label as</span>
            <SegmentedControl
              options={WEIGHT_LABEL_OPTIONS}
              value={c.weightLabel}
              onChange={(v) => onChange({ weightLabel: v })}
            />
          </div>
        )}
        {c.hasWeight && c.weightLabel === 'added_load' && (
          <Toggle
            label="Bodyweight movement (e.g. pull-up)"
            description="Effort is measured as (bodyweight + load) ÷ bodyweight, and assisted (negative) load is allowed."
            checked={c.isBodyweight}
            onChange={(v) => onChange({ isBodyweight: v })}
          />
        )}
        {c.hasWeight && c.weightLabel === 'load' && (
          <Toggle
            label="Allow negative load (e.g. assisted via pulley)"
            description="Lets the load go below zero for assisted work."
            checked={c.supportsNegativeLoad}
            onChange={(v) => onChange({ supportsNegativeLoad: v })}
          />
        )}
        {tracking === 'duration' && (
          <Toggle
            label="Alternating work and rest within each set (e.g. Abrahang)"
            description="Repeats a short work/rest cycle within one set."
            checked={c.hasIntraRest}
            onChange={(v) => onChange({ hasIntraRest: v })}
          />
        )}
        <Toggle
          label="Track edge depth (mm)"
          description="Show an edge-depth input on the set row (hangboard)."
          checked={c.hasEdgeDepth}
          onChange={(v) => onChange({ hasEdgeDepth: v })}
        />
      </div>
    </div>
  )
}

function Toggle({
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
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

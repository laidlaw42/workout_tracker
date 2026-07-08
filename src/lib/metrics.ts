import type { Exercise, ExerciseMetric, TrackingType, WeightLabel } from '@/types'

// The exercise "Parameters" model: an exercise tracks any independent combination
// of these metrics, each with an optional default value. The editor shows one
// toggle + stepper per metric in this order; the set row surfaces exactly the
// enabled ones. The legacy trackingType + weight/edge flags are *derived* from the
// enabled metrics (see metricsToConfig), so the rest of the app is unchanged.
export const METRIC_ORDER: ExerciseMetric[] = [
  'sets',
  'reps',
  'duration',
  'distance',
  'rest',
  'edge',
  'weight',
  'load',
]

// Display label + unit for each metric (used by the editor + set row).
export const METRIC_LABEL: Record<ExerciseMetric, string> = {
  sets: 'Sets',
  reps: 'Reps',
  duration: 'Duration (s)',
  distance: 'Distance (km)',
  rest: 'Rest (s)',
  edge: 'Edge (mm)',
  weight: 'Weight (kg)',
  load: 'Load ±',
}

// Sort an enabled-metric list into the canonical display order.
export function sortMetrics(metrics: readonly ExerciseMetric[]): ExerciseMetric[] {
  return METRIC_ORDER.filter((m) => metrics.includes(m))
}

// Legacy config → metrics. A pre-simplification exercise carried a trackingType
// plus weight/edge flags; map those to the independent-metric model so existing
// records (and the one-off migration) read consistently.
export function deriveMetricsFromConfig(
  ex: Pick<
    Exercise,
    'trackingType' | 'hasWeight' | 'weightLabel' | 'isBodyweight' | 'hasEdgeDepth'
  >,
): ExerciseMetric[] {
  const m: ExerciseMetric[] = []
  if (ex.trackingType === 'distance') {
    // A cardio bout logs both distance and time.
    m.push('distance', 'duration')
  } else {
    m.push('sets', ex.trackingType === 'duration' ? 'duration' : 'reps', 'rest')
  }
  if (ex.hasWeight) {
    // Load = bodyweight-relative (± assisted/added); Weight = an absolute barbell load.
    const load = ex.isBodyweight || ex.weightLabel === 'load' || ex.weightLabel === 'added_load'
    m.push(load ? 'load' : 'weight')
  }
  if (ex.hasEdgeDepth) m.push('edge')
  return sortMetrics(m)
}

// The enabled metrics for an exercise: its stored `metrics` if present, else derived
// from the legacy config (so un-migrated records still behave).
export function exerciseMetrics(ex: Exercise): ExerciseMetric[] {
  return ex.metrics && ex.metrics.length > 0 ? sortMetrics(ex.metrics) : deriveMetricsFromConfig(ex)
}

export interface DerivedConfig {
  trackingType: TrackingType
  hasWeight: boolean
  weightLabel: WeightLabel
  isBodyweight: boolean
  supportsNegativeLoad: boolean
  hasEdgeDepth: boolean
}

// Metrics → the derived legacy config the set row / PR / progress code reads. Weight
// is an absolute load; Load is bodyweight-relative and signed (stored in
// additionalWeightKg, shown as a % of bodyweight), matching the two toggles.
export function metricsToConfig(metrics: readonly ExerciseMetric[]): DerivedConfig {
  const has = (m: ExerciseMetric) => metrics.includes(m)
  const load = has('load')
  return {
    trackingType: has('distance') ? 'distance' : has('duration') ? 'duration' : 'reps',
    hasWeight: has('weight') || load,
    weightLabel: load ? 'load' : 'weight',
    isBodyweight: load,
    supportsNegativeLoad: load,
    hasEdgeDepth: has('edge'),
  }
}

// Whether an exercise's load is bodyweight-relative (the Load metric) — used by PR
// detection to decide the added-load-alone weight PR.
export function isBodyweightLoaded(ex: Exercise): boolean {
  return exerciseMetrics(ex).includes('load')
}

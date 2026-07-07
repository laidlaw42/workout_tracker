import type { HangboardSet, TemplateExercise, WorkoutTemplate } from '@/types'
import { templateCategories } from '@/lib/templateCategories'

// A101 — a rough per-set work time for reps-based exercises (10 reps ≈ 40s).
const SECONDS_PER_REP = 4

export interface EstimateRow {
  name: string
  // Estimated seconds, or null when it can't be estimated (a distance row → "varies").
  seconds: number | null
}

export interface TemplateEstimate {
  totalSeconds: number
  rows: EstimateRow[]
  hasVaries: boolean
}

// A101 — time for one exercise's sets: sets × (set work + rest + pre-count). Set
// work is the hold duration for timed rows, or reps × 4s for reps rows. Distance
// rows have no reliable estimate → null ("varies").
function exerciseSeconds(ex: TemplateExercise, precount: number): number | null {
  const sets = Math.max(0, ex.defaultSets || 0)
  let setWork: number
  if (ex.defaultDuration != null) {
    setWork = ex.defaultDuration
  } else if (ex.defaultReps != null) {
    setWork = ex.defaultReps * SECONDS_PER_REP
  } else {
    return null // distance / unspecified — varies
  }
  return sets * (setWork + ex.defaultRestSeconds + precount)
}

// A101 — time for one hangboard set. Abrahang work is reps × (hang + intra-rest);
// other hang types are a single hang. Plus rest + pre-count per set.
function hangSeconds(h: HangboardSet, precount: number): number {
  const sets = Math.max(0, h.sets || 0)
  const isAbra = (h.hangType ?? 'sub_max') === 'abrahang'
  const setWork = isAbra
    ? (h.abrahangReps ?? 6) * (h.durationSeconds + (h.intraRestSeconds ?? 3))
    : h.durationSeconds
  return sets * (setWork + h.restSeconds + precount)
}

// A101 — estimate a template's total working time plus a per-item breakdown. A
// cardio template's target duration is added directly (not modelled set-by-set).
export function estimateTemplate(t: WorkoutTemplate, precount: number): TemplateEstimate {
  const rows: EstimateRow[] = []
  let total = 0
  let hasVaries = false

  for (const ex of t.exercises ?? []) {
    const s = exerciseSeconds(ex, precount)
    rows.push({ name: ex.exerciseName, seconds: s })
    if (s == null) hasVaries = true
    else total += s
  }
  for (const h of t.hangboardSets ?? []) {
    const s = hangSeconds(h, precount)
    rows.push({ name: h.gripType, seconds: s })
    total += s
  }
  // A101 — a cardio component contributes its target duration directly.
  if (templateCategories(t).includes('cardio') && t.targetDurationSeconds != null) {
    rows.push({ name: 'Cardio', seconds: t.targetDurationSeconds })
    total += t.targetDurationSeconds
  }

  return { totalSeconds: total, rows, hasVaries }
}

// A human-readable range rounded to the nearest 5 minutes, e.g. "45–55 min".
export function formatEstimateRange(totalSeconds: number): string {
  const mins = totalSeconds / 60
  if (mins < 2.5) return '< 5 min'
  const center = Math.round(mins / 5) * 5
  const lower = Math.max(5, center - 5)
  const upper = center + 5
  return `${lower}–${upper} min`
}

// A single item's estimate, e.g. "~12 min" (or "varies" for distance).
export function formatRowEstimate(seconds: number | null): string {
  if (seconds == null) return 'varies'
  const mins = Math.round(seconds / 60)
  return mins < 1 ? '<1 min' : `~${mins} min`
}

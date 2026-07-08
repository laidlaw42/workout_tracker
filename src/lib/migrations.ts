// Pure record-transform helpers shared by the Dexie version upgrades (src/db/db.ts)
// and the import normalisers (src/db/helpers.ts). Keeping the logic here — rather
// than inline in the `.upgrade()` closures — means the highest-consequence code in
// the app (a bad migration silently corrupts records) is unit-testable, and the
// upgrade path and the import path can't drift apart.

export type TemplateCategory = 'strength' | 'cardio' | 'climbing' | 'rehab'

// v6 (A36) — an exercise with no explicit category: distance work is cardio,
// everything else strength.
export function categoryForTracking(trackingType: string | undefined): 'cardio' | 'strength' {
  return trackingType === 'distance' ? 'cardio' : 'strength'
}

const VALID_CATEGORIES = new Set<TemplateCategory>(['strength', 'cardio', 'climbing', 'rehab'])

// v8 (A94/F46) — derive a template's `categories` from its legacy single `type`
// and its actual content. Cardio maps straight through; everything else derives
// from the distinct categories of its exercises (hangboard reads as climbing, A92)
// plus climbing for any hangboard sets, falling back to the legacy type (or
// strength) when there's no classifiable content. `exCat` maps exerciseId →
// category. Never returns empty.
export function legacyTemplateToCategories(
  t: {
    type?: string
    exercises?: { exerciseId?: string }[]
    hangboardSets?: unknown[]
  },
  exCat: Map<string, string>,
): TemplateCategory[] {
  const legacy = t.type
  if (legacy === 'cardio') return ['cardio']
  const s = new Set<TemplateCategory>()
  for (const ex of t.exercises ?? []) {
    const c = ex.exerciseId ? exCat.get(ex.exerciseId) : undefined
    if (c === 'hangboard') s.add('climbing')
    else if (c && VALID_CATEGORIES.has(c as TemplateCategory)) s.add(c as TemplateCategory)
  }
  if ((t.hangboardSets?.length ?? 0) > 0) s.add('climbing')
  if (s.size > 0) return [...s]
  return legacy === 'climbing' ? ['climbing'] : ['strength']
}

// v7 (F30) — the climbing board venue was renamed 'home' → 'board'.
export function normaliseBoardVenue(venue: string | undefined): string | undefined {
  return venue === 'home' ? 'board' : venue
}

// F51 — the per-exercise tracking-config fields (mirrors Exercise's optional set).
export type WeightLabel = 'weight' | 'added_load' | 'load'
export interface ExerciseParams {
  hasWeight: boolean
  weightLabel: WeightLabel
  isBodyweight: boolean
  supportsNegativeLoad: boolean
  hasIntraRest: boolean
  hasEdgeDepth: boolean
}

// v9 (F51) — derive the six tracking-config fields from a pre-F51 exercise,
// replacing the single `supportsAdditionalWeight` flag. Shared by the Dexie v9
// upgrade and the import normaliser so they can't drift.
//
// This deliberately CORRECTS the F51 spec where that spec was self-inconsistent:
//  • hasWeight — F51 said "= supportsAdditionalWeight", which would strip the
//    weight input off every barbell lift (squat, bench, …). A weighted move is
//    any reps-tracked exercise that isn't rehab/cardio, plus every loadable move
//    and every hangboard exercise (load), regardless of tracking type.
//  • weightLabel — 'load' for hangboard, 'added_load' for a bodyweight-plus-load
//    move (the old flag), else 'weight'.
//  • isBodyweight — added_load OR hangboard: both compute % as (BW + load) / BW.
//  • supportsNegativeLoad — every bodyweight move, NOT hangboard-only: assisted
//    pull-ups/dips need negative load exactly as assisted hangs do (A99).
//  • hasIntraRest — the Abrahang protocol (work/rest phases within a set).
//  • hasEdgeDepth — hangboard (edge size on the set row).
export function deriveExerciseParams(e: {
  supportsAdditionalWeight?: boolean
  category?: string
  trackingType?: string
  hangboard?: { hangType?: string } | null
}): ExerciseParams {
  const isHangboard = e.category === 'hangboard'
  const loadable = e.supportsAdditionalWeight === true
  const weightLabel: WeightLabel = isHangboard ? 'load' : loadable ? 'added_load' : 'weight'
  const isBodyweight = weightLabel === 'added_load' || isHangboard
  const weightedByTracking =
    e.trackingType === 'reps' && e.category !== 'rehab' && e.category !== 'cardio'
  return {
    hasWeight: isHangboard || loadable || weightedByTracking,
    weightLabel,
    isBodyweight,
    supportsNegativeLoad: isBodyweight,
    hasIntraRest: e.hangboard?.hangType === 'abrahang',
    hasEdgeDepth: isHangboard,
  }
}

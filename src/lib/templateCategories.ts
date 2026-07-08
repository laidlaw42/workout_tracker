// A94/F46 — helpers for the multi-category template model. A WorkoutTemplate spans
// one or more `categories` (strength/cardio/climbing/rehab). These utilities read
// categories defensively (falling back to the pre-F46 single `type` for any record
// that somehow escaped migration) and derive a single session DisciplineType when
// a session is started from a template.

import { isHangExerciseId } from '@/lib/hangboard'
import type { DisciplineType, TemplateCategory, WorkoutTemplate } from '@/types'

// A UI-only build category. 'hangboard' isn't a stored TemplateCategory (a
// hangboard workout is filed under 'climbing' with hangboardSets), but the
// workout builder offers it as its own pill so a pure hangboard workout can be
// created without going through Climbing — matching the library tabs.
export type WorkoutCategory = TemplateCategory | 'hangboard'

export const WORKOUT_CATEGORY_OPTIONS: { value: WorkoutCategory; label: string }[] = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'strength', label: 'Strength' },
]

// Build categories (may include 'hangboard') → stored TemplateCategory[]: hangboard
// maps to 'climbing', deduped, order preserved. Used on save.
export function buildToStoredCategories(build: WorkoutCategory[]): TemplateCategory[] {
  const out: TemplateCategory[] = []
  for (const c of build) {
    const mapped: TemplateCategory = c === 'hangboard' ? 'climbing' : c
    if (!out.includes(mapped)) out.push(mapped)
  }
  return out
}

// F51 — a hang is a grip exercise (ex_hang_*), so "does this template contain
// hangs?" is "does it reference any grip exercise?". Legacy pre-migration records
// carried a separate hangboardSets array instead.
export function templateHasHangs(
  t: Pick<WorkoutTemplate, 'hangboardSets' | 'exercises'>,
): boolean {
  return (
    (t.exercises ?? []).some((e) => isHangExerciseId(e.exerciseId)) ||
    (t.hangboardSets?.length ?? 0) > 0
  )
}

// A "hangboard-only" workout is nothing but grips — it reads as Hangboard (its own
// library tab + badge). A template mixing hangs with climbing/strength exercises
// stays under its real categories. Single source of truth for the library filter
// and the card badge, so they never disagree.
export function isHangboardOnlyTemplate(
  t: Pick<WorkoutTemplate, 'hangboardSets' | 'exercises'>,
): boolean {
  const exs = t.exercises ?? []
  if (exs.length > 0) return exs.every((e) => isHangExerciseId(e.exerciseId))
  return (t.hangboardSets?.length ?? 0) > 0 // legacy pre-F51 record
}

// Reconstruct the build categories (with 'hangboard') when editing a template: a
// hangboard-only workout (hangs, no exercises) shows as just Hangboard; a mix of
// hangs + exercises keeps its stored categories plus Hangboard.
export function storedToBuildCategories(
  t: Pick<WorkoutTemplate, 'categories' | 'type' | 'hangboardSets' | 'exercises'>,
): WorkoutCategory[] {
  if (isHangboardOnlyTemplate(t)) return ['hangboard']
  const build: WorkoutCategory[] = [...templateCategories(t)]
  if (templateHasHangs(t)) build.push('hangboard')
  return build
}

type CategoryReadable = Pick<WorkoutTemplate, 'categories' | 'type' | 'hangboardSets'>

// Best-effort category list for a legacy record still carrying single `type`. The
// real F46 migration derives 'mixed' from content; this runtime fallback keeps the
// UI sane for any un-migrated/backup record.
function legacyTypeToCategories(t: Pick<WorkoutTemplate, 'type' | 'hangboardSets'>): TemplateCategory[] {
  const type = t.type
  if (type === 'strength' || type === 'cardio' || type === 'climbing') return [type]
  // 'mixed' or unknown: climbing if it has hangboard sets (A92), else strength.
  if ((t.hangboardSets?.length ?? 0) > 0) return ['climbing']
  return ['strength']
}

// The categories a template spans — always non-empty. Prefer the stored array;
// fall back to the legacy `type` only if `categories` is missing/empty.
export function templateCategories(t: CategoryReadable): TemplateCategory[] {
  return t.categories && t.categories.length > 0 ? t.categories : legacyTypeToCategories(t)
}

// Which single session discipline to start from a template. Sessions keep their own
// DisciplineType (incl. 'mixed'); this maps the template's categories + content to
// the right session screen:
//   - a genuine climbing (route/workout) template → 'climbing' (logs routes)
//   - single cardio → 'cardio'
//   - strength and/or rehab only (no hangs) → 'strength'
//   - everything else (multiple disciplines, or any hangboard sets) → 'mixed'
export function deriveSessionType(
  t: Pick<WorkoutTemplate, 'categories' | 'type' | 'hangboardSets' | 'exercises' | 'climbingKind'>,
): DisciplineType {
  const cats = templateCategories(t)
  const hasHangs = templateHasHangs(t)
  const single = cats.length === 1 ? cats[0] : null
  // climbingKind is only set on templates saved from a climbing session — those
  // open the climbing screen so routes can be logged (it also handles hangs).
  if (single === 'climbing' && t.climbingKind) return 'climbing'
  if (single === 'cardio' && !hasHangs) return 'cardio'
  if (cats.every((c) => c === 'strength' || c === 'rehab') && !hasHangs) return 'strength'
  return 'mixed'
}

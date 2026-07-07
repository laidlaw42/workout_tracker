// A94/F46 — helpers for the multi-category template model. A WorkoutTemplate spans
// one or more `categories` (strength/cardio/climbing/rehab). These utilities read
// categories defensively (falling back to the pre-F46 single `type` for any record
// that somehow escaped migration) and derive a single session DisciplineType when
// a session is started from a template.

import type { DisciplineType, TemplateCategory, WorkoutTemplate } from '@/types'

// The four selectable template categories, in the app-wide alphabetical order (A93).
export const TEMPLATE_CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'strength', label: 'Strength' },
]

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
  t: Pick<WorkoutTemplate, 'categories' | 'type' | 'hangboardSets' | 'climbingKind'>,
): DisciplineType {
  const cats = templateCategories(t)
  const hasHangs = (t.hangboardSets?.length ?? 0) > 0
  const single = cats.length === 1 ? cats[0] : null
  // climbingKind is only set on templates saved from a climbing session — those
  // open the climbing screen so routes can be logged (it also handles hangs).
  if (single === 'climbing' && t.climbingKind) return 'climbing'
  if (single === 'cardio' && !hasHangs) return 'cardio'
  if (cats.every((c) => c === 'strength' || c === 'rehab') && !hasHangs) return 'strength'
  return 'mixed'
}

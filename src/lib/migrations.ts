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

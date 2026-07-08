import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bandage,
  Bike,
  Building2,
  Dumbbell,
  Footprints,
  Hand,
  Home,
  Layers,
  Mountain,
  Waves,
  Zap,
} from 'lucide-react'
import { CLIMB_STYLE_ICONS } from '@/lib/climbing'
import { assertNever } from '@/lib/assert'
import { isHangboardOnlyTemplate, templateCategories } from '@/lib/templateCategories'
import type {
  CardioActivityType,
  ClimbingRoute,
  ClimbingStyle,
  ExerciseCategory,
  TemplateCategory,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types'

// A rendered badge: a vector icon, a short label, and static Tailwind colour
// classes (never build `bg-${x}` — Tailwind would purge it).
export interface Badge {
  Icon: LucideIcon
  label: string
  classes: string
}

// Accent tones per entry family. Strength is red (#ef4444), climbing venues get
// distinct hues so gym/crag/home read apart at a glance.
// F49 — theme-adaptive badge tints: a darker text shade in light themes (the old
// fixed *-300 washed out on light backgrounds), the same lighter shade in dark
// themes via the dark: variant. Fill stays /15; the dark look is unchanged.
const TONE = {
  strength: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30',
  cardio: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  climbing: 'bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30',
  rehab: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30', // (F31)
  gym: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30', // (F47)
  crag: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  board: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30', // (F47)
  mixed: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30', // (A66)
} as const

const CARDIO: Record<CardioActivityType, { Icon: LucideIcon; label: string }> = {
  run: { Icon: Footprints, label: 'Run' },
  ride: { Icon: Bike, label: 'Ride' },
  row: { Icon: Waves, label: 'Row' },
  other: { Icon: Zap, label: 'Cardio' },
}

// F44 — one Lucide icon set for the three climb types across the whole app; the
// badges reuse the same CLIMB_STYLE_ICONS the climb-type buttons/RouteCards use.
const STYLE: Record<ClimbingStyle, { Icon: LucideIcon; label: string }> = {
  bouldering: { Icon: CLIMB_STYLE_ICONS.bouldering, label: 'Bouldering' },
  top_rope: { Icon: CLIMB_STYLE_ICONS.top_rope, label: 'Top rope' },
  lead: { Icon: CLIMB_STYLE_ICONS.lead, label: 'Lead' },
}

// Venue quick-start entries in the Library (lucide icons, per-venue colour).
export const VENUE_BADGES: Record<'gym' | 'crag' | 'board', Badge> = {
  gym: { Icon: Building2, label: 'Gym', classes: TONE.gym },
  crag: { Icon: Mountain, label: 'Crag', classes: TONE.crag },
  board: { Icon: Home, label: 'Board', classes: TONE.board },
}

// Rehab exercise category (F31) — sky blue with a bandage icon.
export const REHAB_BADGE: Badge = { Icon: Bandage, label: 'Rehab', classes: TONE.rehab }

export type ClimbingVenue = 'gym' | 'crag' | 'board'

// Normalise a stored climbingVenue to a known key. Pre-F30 sessions may still
// hold the legacy 'home' value if the one-time migration hasn't run (it's
// best-effort); treat it as 'board' so lookups never fall through to undefined.
export function normalizeVenue(v: string | null | undefined): ClimbingVenue | undefined {
  if (v === 'home') return 'board'
  return v === 'gym' || v === 'crag' || v === 'board' ? v : undefined
}

const STRENGTH: Badge = { Icon: Dumbbell, label: 'Strength', classes: TONE.strength }
// Mixed-discipline session (A66) — a build-from-scratch workout spanning types.
const MIXED: Badge = { Icon: Layers, label: 'Mixed', classes: TONE.mixed }
const HANGBOARD = (classes: string): Badge => ({ Icon: Hand, label: 'Hangboard', classes })
const CLIMB_WORKOUT = (classes: string): Badge => ({ Icon: Activity, label: 'Workout', classes })

function cardioBadge(activity: CardioActivityType = 'other'): Badge {
  const c = CARDIO[activity]
  return { Icon: c.Icon, label: c.label, classes: TONE.cardio }
}

// Badge for an exercise's category (A76) — shown on library/picker rows so a
// discipline reads at a glance. Colours match the app: strength red, cardio
// coral, climbing/hangboard green (distinguished by icon — Mountain vs Hand),
// rehab sky.
export function badgeForCategory(category: ExerciseCategory): Badge {
  switch (category) {
    case 'strength':
      return STRENGTH
    case 'cardio':
      return cardioBadge()
    case 'climbing':
      return { Icon: Mountain, label: 'Climbing', classes: TONE.climbing }
    case 'rehab':
      return REHAB_BADGE
    case 'hangboard':
      return HANGBOARD(TONE.climbing)
    default:
      return assertNever(category, 'exercise category')
  }
}

// A94 — display order for a template's category pills (app-wide alphabetical, A93).
const CATEGORY_BADGE_ORDER: TemplateCategory[] = ['cardio', 'climbing', 'rehab', 'strength']

function templateCategoryBadge(t: WorkoutTemplate, c: TemplateCategory): Badge {
  // Cardio keeps its activity-specific icon; the others use the category badge.
  return c === 'cardio' ? cardioBadge(t.cardioActivity) : badgeForCategory(c)
}

// A94 — one badge per category a template spans, shown as a row of pills on the
// template card. Ordered alphabetically for a stable read. A hangboard-only
// workout reads as Hangboard (not Climbing); a mix of hangs + exercises keeps its
// category badges plus a Hangboard pill — mirroring the library tabs.
export function badgesForTemplate(t: WorkoutTemplate): Badge[] {
  if (isHangboardOnlyTemplate(t)) return [HANGBOARD(TONE.climbing)]
  const cats = templateCategories(t)
  const badges = CATEGORY_BADGE_ORDER.filter((c) => cats.includes(c)).map((c) =>
    templateCategoryBadge(t, c),
  )
  if ((t.hangboardSets?.length ?? 0) > 0) badges.push(HANGBOARD(TONE.climbing))
  return badges
}

// Extra per-session info needed to pick a climbing/cardio subtype. Sessions don't
// store this, so it's derived from their logged content (see deriveSessionKind).
export interface SessionKind {
  cardioActivity?: CardioActivityType
  climbingStyle?: ClimbingStyle // dominant logged route style
  climbingStyles?: ClimbingStyle[] // every distinct logged route style (A25)
  climbingIsHangboard?: boolean
  climbingIsWorkout?: boolean
}

export function badgeForSession(s: WorkoutSession, kind?: SessionKind): Badge {
  if (s.type === 'strength') return STRENGTH
  if (s.type === 'mixed') {
    // A73: a training session whose only logged content is hangs reads as a
    // Hangboard session (green identity); anything with sets too stays Mixed.
    if (kind?.climbingIsHangboard) return HANGBOARD(TONE.climbing)
    return MIXED
  }
  if (s.type === 'cardio') return cardioBadge(kind?.cardioActivity ?? s.plannedActivity)

  if (s.type === 'climbing') {
    // Climbing: colour follows the venue (blue/amber/green); the icon follows the
    // logged subtype so a crag-lead and a gym-boulder read apart.
    const venue = normalizeVenue(s.climbingVenue)
    const classes = venue ? TONE[venue] : TONE.climbing
    if (kind?.climbingStyle) {
      const st = STYLE[kind.climbingStyle]
      return { Icon: st.Icon, label: st.label, classes }
    }
    if (kind?.climbingIsHangboard) return HANGBOARD(classes)
    if (kind?.climbingIsWorkout) return CLIMB_WORKOUT(classes)
    // Nothing logged yet — fall back to the venue identity, else generic climbing.
    if (venue) return VENUE_BADGES[venue]
    return { Icon: Mountain, label: 'Climbing', classes: TONE.climbing }
  }
  // Exhaustive: a new DisciplineType must add a branch above rather than silently
  // rendering as a climbing badge.
  return assertNever(s.type, 'session type')
}

function dominantStyle(routes: ClimbingRoute[]): ClimbingStyle {
  const counts: Record<ClimbingStyle, number> = { bouldering: 0, top_rope: 0, lead: 0 }
  for (const r of routes) counts[r.style]++
  let best: ClimbingStyle = 'bouldering'
  for (const s of ['bouldering', 'top_rope', 'lead'] as ClimbingStyle[]) {
    if (counts[s] > counts[best]) best = s
  }
  return best
}

// Classify a session from its already-loaded logged content. Priority: routes
// (a climb session) → hangs (hangboard) → sets (climbing workout).
export function deriveSessionKind(
  session: WorkoutSession,
  data: { routes?: ClimbingRoute[]; hasHang?: boolean; hasSet?: boolean; cardioActivity?: CardioActivityType },
): SessionKind {
  if (session.type === 'cardio') {
    return { cardioActivity: data.cardioActivity ?? session.plannedActivity ?? 'other' }
  }
  if (session.type === 'climbing') {
    if (data.routes && data.routes.length) {
      const logged = new Set(data.routes.map((r) => r.style))
      const styles = (['bouldering', 'top_rope', 'lead'] as ClimbingStyle[]).filter((s) =>
        logged.has(s),
      )
      return { climbingStyle: dominantStyle(data.routes), climbingStyles: styles }
    }
    if (data.hasHang) return { climbingIsHangboard: true }
    if (data.hasSet) return { climbingIsWorkout: true }
  }
  // A73: a mixed (training) session with hangs but no sets is a hangboard session.
  if (session.type === 'mixed' && data.hasHang && !data.hasSet) {
    return { climbingIsHangboard: true }
  }
  return {}
}

// Like badgeForSession but returns one badge per distinct logged climb style for
// completed climbing sessions (A25); other cases return a single badge.
export function badgesForSession(s: WorkoutSession, kind?: SessionKind): Badge[] {
  if (s.type === 'climbing' && kind?.climbingStyles && kind.climbingStyles.length) {
    const venue = normalizeVenue(s.climbingVenue)
    const classes = venue ? TONE[venue] : TONE.climbing
    return kind.climbingStyles.map((st) => ({ Icon: STYLE[st].Icon, label: STYLE[st].label, classes }))
  }
  return [badgeForSession(s, kind)]
}

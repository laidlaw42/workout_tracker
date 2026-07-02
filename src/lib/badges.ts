import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Anchor,
  Bike,
  Box,
  Building2,
  Cable,
  Dumbbell,
  Footprints,
  Hand,
  Home,
  Mountain,
  Waves,
  Zap,
} from 'lucide-react'
import type {
  CardioActivityType,
  ClimbingRoute,
  ClimbingStyle,
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
const TONE = {
  strength: 'bg-red-500/15 text-red-300 ring-red-500/30',
  cardio: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  climbing: 'bg-green-500/15 text-green-300 ring-green-500/30',
  gym: 'bg-blue-500/15 text-blue-300 ring-blue-500/30', // #3b82f6
  crag: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', // #f59e0b
  home: 'bg-green-500/15 text-green-300 ring-green-500/30', // #22c55e
} as const

const CARDIO: Record<CardioActivityType, { Icon: LucideIcon; label: string }> = {
  run: { Icon: Footprints, label: 'Run' },
  ride: { Icon: Bike, label: 'Ride' },
  row: { Icon: Waves, label: 'Row' },
  other: { Icon: Zap, label: 'Cardio' },
}

const STYLE: Record<ClimbingStyle, { Icon: LucideIcon; label: string }> = {
  bouldering: { Icon: Box, label: 'Bouldering' },
  top_rope: { Icon: Cable, label: 'Top rope' },
  lead: { Icon: Anchor, label: 'Lead' },
}

// Venue quick-start entries in the Library (lucide icons, per-venue colour).
export const VENUE_BADGES: Record<'gym' | 'crag' | 'home', Badge> = {
  gym: { Icon: Building2, label: 'Gym', classes: TONE.gym },
  crag: { Icon: Mountain, label: 'Crag', classes: TONE.crag },
  home: { Icon: Home, label: 'Home', classes: TONE.home },
}

const STRENGTH: Badge = { Icon: Dumbbell, label: 'Strength', classes: TONE.strength }
const HANGBOARD = (classes: string): Badge => ({ Icon: Hand, label: 'Hangboard', classes })
const CLIMB_WORKOUT = (classes: string): Badge => ({ Icon: Activity, label: 'Workout', classes })

function cardioBadge(activity: CardioActivityType = 'other'): Badge {
  const c = CARDIO[activity]
  return { Icon: c.Icon, label: c.label, classes: TONE.cardio }
}

export function badgeForTemplate(t: WorkoutTemplate): Badge {
  if (t.type === 'strength') return STRENGTH
  if (t.type === 'cardio') return cardioBadge(t.cardioActivity)
  // climbing template — hangboard or workout
  return t.climbingKind === 'hangboard' ? HANGBOARD(TONE.climbing) : CLIMB_WORKOUT(TONE.climbing)
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
  if (s.type === 'cardio') return cardioBadge(kind?.cardioActivity ?? s.plannedActivity)

  // Climbing: colour follows the venue (blue/amber/green); the icon follows the
  // logged subtype so a crag-lead and a gym-boulder read apart.
  const classes = s.climbingVenue ? TONE[s.climbingVenue] : TONE.climbing
  if (kind?.climbingStyle) {
    const st = STYLE[kind.climbingStyle]
    return { Icon: st.Icon, label: st.label, classes }
  }
  if (kind?.climbingIsHangboard) return HANGBOARD(classes)
  if (kind?.climbingIsWorkout) return CLIMB_WORKOUT(classes)
  // Nothing logged yet — fall back to the venue identity, else generic climbing.
  if (s.climbingVenue) return VENUE_BADGES[s.climbingVenue]
  return { Icon: Mountain, label: 'Climbing', classes: TONE.climbing }
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
  return {}
}

// Like badgeForSession but returns one badge per distinct logged climb style for
// completed climbing sessions (A25); other cases return a single badge.
export function badgesForSession(s: WorkoutSession, kind?: SessionKind): Badge[] {
  if (s.type === 'climbing' && kind?.climbingStyles && kind.climbingStyles.length) {
    const classes = s.climbingVenue ? TONE[s.climbingVenue] : TONE.climbing
    return kind.climbingStyles.map((st) => ({ Icon: STYLE[st].Icon, label: STYLE[st].label, classes }))
  }
  return [badgeForSession(s, kind)]
}

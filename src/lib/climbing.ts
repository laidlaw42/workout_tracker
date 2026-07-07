import {
  Anchor,
  Flag,
  Gem,
  Inbox,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ClimbCharacter, ClimbingStyle, ClimbingTick } from '@/types'

// Physical character of a climb (A45) — replaces the old Slab/Vertical/Overhang
// wall-angle toggle with a 6-option superset. Each carries a Lucide icon (A63)
// evoking the wall shape; `iconClassName` applies any rotation (e.g. a Minus
// stood on end for a vertical wall).
export const CLIMB_CHARACTERS: {
  value: ClimbCharacter
  label: string
  icon: LucideIcon
  iconClassName?: string
}[] = [
  { value: 'slab', label: 'Slab', icon: TrendingDown }, // leaning away
  { value: 'vertical', label: 'Vertical', icon: Minus, iconClassName: 'rotate-90' }, // upright line
  { value: 'overhang', label: 'Overhang', icon: TrendingUp }, // leaning toward
  { value: 'roof', label: 'Roof', icon: Minus }, // horizontal ceiling
  { value: 'cave', label: 'Cave', icon: Inbox }, // arched enclosure
  { value: 'crack', label: 'Crack', icon: Zap }, // jagged line
]

export const CLIMB_CHARACTER_LABEL: Record<ClimbCharacter, string> = Object.fromEntries(
  CLIMB_CHARACTERS.map((c) => [c.value, c.label]),
) as Record<ClimbCharacter, string>

// Freeform style descriptors for a route (A47, A52, A72), multi-select. Stored
// values are the strings themselves, except 'take' which displays as "Take 😩".
export const CLIMB_STYLE_TAGS = [
  'Crimpy', 'Juggy', 'Pumpy', 'Slopey', 'Pinchy', 'Dynamic', 'Static', 'Technical',
  'Powerful', 'Endurance', 'Compression', 'Balancy', 'Mantle', 'Stemmy', 'Roofed',
  'Fingery', 'Thuggish', 'Garbage', 'Sandbagged', 'Chossy', 'Painful',
  'Stretchy', 'Short', 'Long', 'Scary', 'Ugly', 'take', 'Off belay',
] as const

// Display label for a style value (A72): 'take' → "Take 😩"; everything else is
// its own label (fixed tags and user-defined custom styles alike).
export function climbStyleLabel(value: string): string {
  return value === 'take' ? 'Take 😩' : value
}

// Elapsed seconds before each logged route (A67): the gap to the previous route,
// or to the session start for the earliest one. Keyed by route id; order-agnostic.
export function routeGapSeconds(
  routes: { id: string; loggedAt: number }[],
  sessionStart: number,
): Map<string, number> {
  const sorted = [...routes].sort((a, b) => a.loggedAt - b.loggedAt)
  const map = new Map<string, number>()
  let prev = sessionStart
  for (const r of sorted) {
    map.set(r.id, Math.max(0, (r.loggedAt - prev) / 1000))
    prev = r.loggedAt
  }
  return map
}

// --- Grades -----------------------------------------------------------------

// Full V-scale. VB and V0 carry -/base/+ sub-grades; V1+ are whole grades only.
export const V_GRADES = [
  'VB-', 'VB', 'VB+',
  'V0-', 'V0', 'V0+',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8',
  'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
] as const

// Monotonic sort value: VB = -1, V0 = 0, … V17 = 17, with sub-grades offsetting
// the whole grade by ±0.33 ('-' below, '+' above). Whole grades stay integers so
// values stored before sub-grades existed still round-trip correctly.
export function vGradeIndex(grade: string): number {
  const m = /^V(B|\d+)([-+]?)$/.exec(grade)
  if (!m) return -1
  const base = m[1] === 'B' ? -1 : Number(m[1])
  const off = m[2] === '-' ? -0.33 : m[2] === '+' ? 0.33 : 0
  return base + off
}

export function vGradeFromIndex(index: number): string {
  const base = Math.round(index)
  const frac = index - base
  const g = base <= -1 ? 'VB' : `V${base}`
  // Sub-grades only exist for VB and V0.
  const suffix = base <= 0 && frac <= -0.25 ? '-' : base <= 0 && frac >= 0.25 ? '+' : ''
  return g + suffix
}

// Full Ewbanks scale (1–39) for the grade picker.
export const EWBANKS_GRADES = Array.from({ length: 39 }, (_, i) => i + 1) // 1..39

// Gym-specific numeric scale (0–35), used when a gym session opts into gym grades.
export const GYM_GRADES = Array.from({ length: 36 }, (_, i) => i) // 0..35

export const STYLE_LABELS: Record<ClimbingStyle, string> = {
  bouldering: 'Bouldering',
  top_rope: 'Top rope',
  lead: 'Lead',
}

// Lucide icons for the three climb types, used on the climb-type buttons (A24) and
// wherever a route's style is shown (RouteCard, SessionDetail, History). F47 swaps
// the earlier geometric icons (a plain pentagon / up-arrow that read as bare
// unicode symbols) for recognizable, distinct ones: Gem ≈ a boulder problem (Crag
// already owns Mountain), Anchor ≈ the fixed top-rope anchor, Flag ≈ leading to the
// top. Kept beside STYLE_LABELS so they never drift.
export const CLIMB_STYLE_ICONS: Record<ClimbingStyle, LucideIcon> = {
  bouldering: Gem,
  top_rope: Anchor,
  lead: Flag,
}

// F47 — an accent tint per climb type for the climb-type buttons. Deliberately
// distinct from the home-screen venue colours (gym pink, board purple, crag amber)
// and from each other. Static strings so Tailwind never purges them.
// Theme-adaptive (F49): darker text in light themes, lighter text + stronger fill
// in dark themes. Full static strings so Tailwind never purges them.
export const CLIMB_STYLE_TONE: Record<ClimbingStyle, string> = {
  bouldering: 'bg-lime-500/15 text-lime-700 dark:bg-lime-500/25 dark:text-lime-300 ring-lime-500/30',
  top_rope: 'bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-300 ring-cyan-500/30',
  lead: 'bg-red-500/15 text-red-700 dark:bg-red-500/25 dark:text-red-300 ring-red-500/30',
}
// Icon/text-only colour per climb type (e.g. the RouteCard style icon).
export const CLIMB_STYLE_TEXT: Record<ClimbingStyle, string> = {
  bouldering: 'text-lime-600 dark:text-lime-400',
  top_rope: 'text-cyan-600 dark:text-cyan-400',
  lead: 'text-red-600 dark:text-red-400',
}

// --- Hangboard --------------------------------------------------------------

// Common hangboard grip types (stored as a string; the picker also allows "Other").
export const GRIP_TYPES = [
  'Half crimp',
  'Open hand',
  'Full crimp',
  'Four-finger open',
  'Front three',
  'Front two',
  'Middle two',
  'Back two',
  'Pinch',
  'Sloper',
] as const

// Human label for a hang's added/assisted load: 0 → "bodyweight", else "+5 kg" /
// "-3 kg". Shared by the live hang card and every hang summary/preview so the
// same load reads identically everywhere.
export function weightLabel(kg: number): string {
  if (kg === 0) return 'bodyweight'
  return `${kg > 0 ? '+' : ''}${kg} kg`
}

// --- Tick types -------------------------------------------------------------

export interface TickOption {
  value: ClimbingTick
  label: string
  desc: string
}

export const TICK_TYPES: Record<ClimbingStyle, TickOption[]> = {
  bouldering: [
    { value: 'onsight', label: 'Onsight', desc: 'First try, no beta' },
    { value: 'flash', label: 'Flash', desc: 'First try, had beta' },
    { value: 'send', label: 'Send', desc: 'Clean, after attempts' },
    { value: 'working', label: 'Working', desc: 'Active project' },
    { value: 'repeat', label: 'Repeat', desc: 'Done it before' },
    { value: 'attempt', label: 'Attempt', desc: 'Tried, did not top out' },
    { value: 'dab', label: 'Dab', desc: 'Touched ground / person' },
  ],
  top_rope: [
    { value: 'onsight', label: 'Onsight', desc: 'First try, no beta' },
    { value: 'flash', label: 'Flash', desc: 'First try, had beta' },
    { value: 'clean', label: 'Clean', desc: 'No falls, after attempts' },
    { value: 'hang_dog', label: 'Hang dog', desc: 'Fell or rested, topped' },
    { value: 'attempt', label: 'Attempt', desc: 'Did not top out' },
    { value: 'retreat', label: 'Retreat', desc: 'Lowered off / bailed' },
  ],
  lead: [
    { value: 'onsight', label: 'Onsight', desc: 'First try, no beta, led' },
    { value: 'flash', label: 'Flash', desc: 'First try, had beta, led' },
    { value: 'redpoint', label: 'Redpoint', desc: 'Clean lead, after attempts' },
    { value: 'pink_point', label: 'Pink point', desc: 'Redpoint, pre-clipped draws' },
    { value: 'hang_dog', label: 'Hang dog', desc: 'Fell or rested, topped' },
    { value: 'attempt', label: 'Attempt', desc: 'Did not top out' },
    { value: 'retreat', label: 'Retreat', desc: 'Bailed before top' },
  ],
}

export const CLEAN_TICKS: ClimbingTick[] = [
  'onsight', 'flash', 'send', 'clean', 'redpoint', 'pink_point',
]

export function isCleanTick(tick: ClimbingTick): boolean {
  return CLEAN_TICKS.includes(tick)
}

const TICK_LABELS: Record<ClimbingTick, string> = {
  onsight: 'Onsight',
  flash: 'Flash',
  send: 'Send',
  working: 'Working',
  repeat: 'Repeat',
  dab: 'Dab',
  clean: 'Clean',
  redpoint: 'Redpoint',
  pink_point: 'Pink point',
  hang_dog: 'Hang dog',
  attempt: 'Attempt',
  retreat: 'Retreat',
}

export function tickLabel(tick: ClimbingTick): string {
  return TICK_LABELS[tick]
}

// Static, complete class strings (never build these dynamically — Tailwind purges).
const TICK_BADGE: Record<ClimbingTick, string> = {
  onsight: 'bg-amber-400 text-amber-950',
  flash: 'bg-amber-300 text-amber-950',
  send: 'bg-green-500 text-green-950',
  clean: 'bg-green-500 text-green-950',
  redpoint: 'bg-green-500 text-green-950',
  pink_point: 'bg-green-500 text-green-950',
  repeat: 'bg-teal-400 text-teal-950',
  working: 'bg-blue-400 text-blue-950',
  hang_dog: 'bg-slate-400 text-slate-950',
  attempt: 'bg-slate-400 text-slate-950',
  retreat: 'bg-slate-400 text-slate-950',
  dab: 'bg-slate-400 text-slate-950',
}

export function tickBadgeClass(tick: ClimbingTick): string {
  return TICK_BADGE[tick]
}

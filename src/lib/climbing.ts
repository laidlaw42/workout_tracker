import type { ClimbCharacter, ClimbingStyle, ClimbingTick } from '@/types'

// Physical character of a climb (A45) — replaces the old Slab/Vertical/Overhang
// wall-angle toggle with a 6-option superset.
export const CLIMB_CHARACTERS: { value: ClimbCharacter; label: string }[] = [
  { value: 'slab', label: 'Slab' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'overhang', label: 'Overhang' },
  { value: 'roof', label: 'Roof' },
  { value: 'cave', label: 'Cave' },
  { value: 'crack', label: 'Crack' },
]

export const CLIMB_CHARACTER_LABEL: Record<ClimbCharacter, string> = Object.fromEntries(
  CLIMB_CHARACTERS.map((c) => [c.value, c.label]),
) as Record<ClimbCharacter, string>

// Freeform style descriptors for a route (A47), multi-select.
export const CLIMB_STYLE_TAGS = [
  'Crimpy', 'Juggy', 'Pumpy', 'Slopey', 'Pinchy', 'Dynamic', 'Static', 'Technical',
  'Powerful', 'Endurance', 'Compression', 'Balancy', 'Mantle', 'Stemmy', 'Roofed',
  'Fingery', 'Thuggish', 'Garbage', 'Sandbagged', 'Chossy', 'Painful',
] as const

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

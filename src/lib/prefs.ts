// Small UI preferences kept in localStorage.

// Generic on/off pref defaulting to ON (only an explicit '0' disables it).
function getBool(key: string): boolean {
  try {
    return localStorage.getItem(key) !== '0'
  } catch {
    return true
  }
}
function setBool(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

// Whether the rest timer auto-starts the next timed set's countdown on expiry.
export const getAutoAdvance = () => getBool('auto_advance_timed')
export const setAutoAdvance = (on: boolean) => setBool('auto_advance_timed', on)

// Whether countdown/rest timer beeps play.
export const getTimerSounds = () => getBool('timer_sounds')
export const setTimerSounds = (on: boolean) => setBool('timer_sounds', on)

// Whether to hold a screen wake lock during an active session.
export const getKeepAwake = () => getBool('keep_awake')
export const setKeepAwake = (on: boolean) => setBool('keep_awake', on)

// First day of the week for the planner calendar: 1 = Monday (default), 0 = Sunday.
export function getWeekStart(): 0 | 1 {
  try {
    return localStorage.getItem('week_start') === '0' ? 0 : 1
  } catch {
    return 1
  }
}
export function setWeekStart(v: 0 | 1): void {
  try {
    localStorage.setItem('week_start', String(v))
  } catch {
    /* ignore */
  }
}

// --- Saved gym locations (A17) ---------------------------------------------

export function getGymLocations(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem('gym_locations') ?? '[]')
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function setGymLocations(list: string[]): void {
  try {
    localStorage.setItem('gym_locations', JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
export function addGymLocation(name: string): string[] {
  const n = name.trim()
  const cur = getGymLocations()
  if (!n || cur.some((g) => g.toLowerCase() === n.toLowerCase())) return cur
  const next = [...cur, n]
  setGymLocations(next)
  return next
}
export function removeGymLocation(name: string): string[] {
  const next = getGymLocations().filter((g) => g !== name)
  setGymLocations(next)
  return next
}

// --- Remembered location names (A17) ---------------------------------------

export type LocationType = 'gym' | 'crag' | 'board'
const LOCATION_KEYS: Record<LocationType, string> = {
  gym: 'saved_gyms',
  crag: 'saved_crags',
  board: 'saved_boards',
}

export function getSavedLocations(type: LocationType): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCATION_KEYS[type]) ?? '[]')
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function writeSavedLocations(type: LocationType, list: string[]): void {
  try {
    localStorage.setItem(LOCATION_KEYS[type], JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
// Promote a name to the front (most recently used); dedup case-insensitively; cap 10.
export function rememberLocation(type: LocationType, name: string): void {
  const n = name.trim()
  if (!n) return
  const rest = getSavedLocations(type).filter((x) => x.toLowerCase() !== n.toLowerCase())
  writeSavedLocations(type, [n, ...rest].slice(0, 10))
}
export function removeSavedLocation(type: LocationType, name: string): string[] {
  const next = getSavedLocations(type).filter((x) => x !== name)
  writeSavedLocations(type, next)
  return next
}
export function renameSavedLocation(type: LocationType, oldName: string, newName: string): string[] {
  const n = newName.trim()
  if (!n) return getSavedLocations(type)
  const seen = new Set<string>()
  const next = getSavedLocations(type)
    .map((x) => (x === oldName ? n : x))
    .filter((x) => {
      const k = x.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  writeSavedLocations(type, next)
  return next
}

// --- Gym grade ranges (A21) -------------------------------------------------

export type GymStyle = 'bouldering' | 'top_rope' | 'lead'
export interface GradeRange {
  min: number
  max: number
}
export type GymGradeRanges = Record<GymStyle, GradeRange>

const DEFAULT_GYM_RANGES: GymGradeRanges = {
  bouldering: { min: 0, max: 35 },
  top_rope: { min: 0, max: 35 },
  lead: { min: 0, max: 35 },
}

function clampGrade(n: unknown, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback
  return Math.max(0, Math.min(35, v))
}

export function getGymGradeRanges(): GymGradeRanges {
  try {
    const p = JSON.parse(localStorage.getItem('gym_grade_ranges') ?? 'null')
    if (!p || typeof p !== 'object') return { ...DEFAULT_GYM_RANGES }
    const one = (k: GymStyle): GradeRange => {
      const r = (p as Record<string, { min?: unknown; max?: unknown }>)[k] ?? {}
      let min = clampGrade(r.min, 0)
      let max = clampGrade(r.max, 35)
      if (min > max) [min, max] = [max, min]
      return { min, max }
    }
    return { bouldering: one('bouldering'), top_rope: one('top_rope'), lead: one('lead') }
  } catch {
    return { ...DEFAULT_GYM_RANGES }
  }
}

export function setGymGradeRanges(ranges: GymGradeRanges): void {
  try {
    localStorage.setItem('gym_grade_ranges', JSON.stringify(ranges))
  } catch {
    /* ignore */
  }
}

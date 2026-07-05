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

// Whether the celebration confetti fires on the session summary screen (A41).
export const getConfettiEnabled = () => getBool('confettiEnabled')
export const setConfettiEnabled = (on: boolean) => setBool('confettiEnabled', on)

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

// Pre-count ("Get ready") seconds before a timed exercise countdown (A30).
// 0 disables it. Clamped 0–10, defaults to 5.
export function getPrecountSeconds(): number {
  try {
    const raw = localStorage.getItem('precountSeconds')
    if (raw == null) return 5
    const v = Number(raw)
    return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : 5
  } catch {
    return 5
  }
}
export function setPrecountSeconds(n: number): void {
  try {
    localStorage.setItem('precountSeconds', String(Math.max(0, Math.min(10, Math.round(n)))))
  } catch {
    /* ignore */
  }
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

function parseRanges(p: unknown): GymGradeRanges {
  if (!p || typeof p !== 'object') return { ...DEFAULT_GYM_RANGES }
  const one = (k: GymStyle): GradeRange => {
    const r = (p as Record<string, { min?: unknown; max?: unknown }>)[k] ?? {}
    let min = clampGrade(r.min, 0)
    let max = clampGrade(r.max, 35)
    if (min > max) [min, max] = [max, min]
    return { min, max }
  }
  return { bouldering: one('bouldering'), top_rope: one('top_rope'), lead: one('lead') }
}

function getAllGymGradeRanges(): Record<string, GymGradeRanges> {
  try {
    const p = JSON.parse(localStorage.getItem('gym_grade_ranges') ?? '{}')
    return p && typeof p === 'object' ? (p as Record<string, GymGradeRanges>) : {}
  } catch {
    return {}
  }
}
function writeAllGymGradeRanges(all: Record<string, GymGradeRanges>): void {
  try {
    localStorage.setItem('gym_grade_ranges', JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

// Per-gym grade ranges (A22), keyed by gym name. Unknown gyms default to 0–35.
export function getGymGradeRanges(gym: string): GymGradeRanges {
  return parseRanges(getAllGymGradeRanges()[gym])
}
export function setGymGradeRanges(gym: string, ranges: GymGradeRanges): void {
  const all = getAllGymGradeRanges()
  all[gym] = ranges
  writeAllGymGradeRanges(all)
}

// Per-gym grade-system preference (F20): remembers whether a gym was last logged
// in standard or gym grades, keyed by gym name, so a new session at that gym
// opens in the same mode. Absent → standard.
export type GradeSystem = 'standard' | 'gym'

function getAllGymGradePrefs(): Record<string, GradeSystem> {
  try {
    const p = JSON.parse(localStorage.getItem('gym_grade_preference') ?? '{}')
    return p && typeof p === 'object' ? (p as Record<string, GradeSystem>) : {}
  } catch {
    return {}
  }
}
function writeAllGymGradePrefs(all: Record<string, GradeSystem>): void {
  try {
    localStorage.setItem('gym_grade_preference', JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
export function getGymGradePreference(gym: string): GradeSystem | undefined {
  const v = getAllGymGradePrefs()[gym]
  return v === 'gym' || v === 'standard' ? v : undefined
}
export function setGymGradePreference(gym: string, mode: GradeSystem): void {
  if (!gym) return
  const all = getAllGymGradePrefs()
  all[gym] = mode
  writeAllGymGradePrefs(all)
}

// Keep the MRU name list and per-gym ranges in sync on rename / delete.
export function deleteGym(name: string): string[] {
  const all = getAllGymGradeRanges()
  if (name in all) {
    delete all[name]
    writeAllGymGradeRanges(all)
  }
  const prefs = getAllGymGradePrefs()
  if (name in prefs) {
    delete prefs[name]
    writeAllGymGradePrefs(prefs)
  }
  return removeSavedLocation('gym', name)
}
export function renameGym(oldName: string, newName: string): string[] {
  const n = newName.trim()
  if (!n || n === oldName) return getSavedLocations('gym')
  const all = getAllGymGradeRanges()
  if (all[oldName]) {
    all[n] = all[oldName]
    delete all[oldName]
    writeAllGymGradeRanges(all)
  }
  const prefs = getAllGymGradePrefs()
  if (prefs[oldName]) {
    prefs[n] = prefs[oldName]
    delete prefs[oldName]
    writeAllGymGradePrefs(prefs)
  }
  return renameSavedLocation('gym', oldName, n)
}

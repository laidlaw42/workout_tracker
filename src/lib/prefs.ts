// Small UI preferences kept in localStorage.
//
// The flat on/off + numeric settings below are registered in a shared, typed,
// reactive settings store (src/lib/settingsStore.ts) — so their keys and defaults
// live in one place and `useSetting(SETTING)` re-renders on change. These thin
// getters/setters keep the existing call sites working; screens that want live
// updates can read `useSetting(...)` directly. Structured-list prefs further down
// (saved gyms/boards, gym areas, grade ranges, custom styles) keep their own bespoke
// storage since they aren't flat values.
import { CLIMB_STYLE_TAGS, climbStyleLabel } from './climbing'
import {
  boolDefaultOff,
  boolDefaultOn,
  getSetting,
  intSetting,
  setSetting,
  type Setting,
} from '@/lib/settingsStore'
import type { ClimbCharacter } from '@/types'

// Whether the rest timer auto-starts the next timed set's countdown on expiry.
export const AUTO_ADVANCE = boolDefaultOn('auto_advance_timed')
export const getAutoAdvance = () => getSetting(AUTO_ADVANCE)
export const setAutoAdvance = (on: boolean) => setSetting(AUTO_ADVANCE, on)

// Whether countdown/rest timer beeps play.
export const TIMER_SOUNDS = boolDefaultOn('timer_sounds')
export const getTimerSounds = () => getSetting(TIMER_SOUNDS)
export const setTimerSounds = (on: boolean) => setSetting(TIMER_SOUNDS, on)

// Whether to hold a screen wake lock during an active session.
export const KEEP_AWAKE = boolDefaultOn('keep_awake')
export const getKeepAwake = () => getSetting(KEEP_AWAKE)
export const setKeepAwake = (on: boolean) => setSetting(KEEP_AWAKE, on)

// Whether the celebration confetti fires on the session summary screen (A41).
export const CONFETTI_ENABLED = boolDefaultOn('confettiEnabled')
export const getConfettiEnabled = () => getSetting(CONFETTI_ENABLED)
export const setConfettiEnabled = (on: boolean) => setSetting(CONFETTI_ENABLED, on)

// Tick-type indicator style (A49): 'symbols' (Unicode) or 'emojis' (default).
// setTickDisplayStyle fires a custom event so useTickSymbol re-renders live.
export const TICK_STYLE_EVENT = 'tickdisplaystylechange'
export function getTickDisplayStyle(): 'symbols' | 'emojis' {
  try {
    return localStorage.getItem('tickDisplayStyle') === 'symbols' ? 'symbols' : 'emojis'
  } catch {
    return 'emojis'
  }
}
export function setTickDisplayStyle(style: 'symbols' | 'emojis'): void {
  try {
    localStorage.setItem('tickDisplayStyle', style)
    window.dispatchEvent(new Event(TICK_STYLE_EVENT))
  } catch {
    /* ignore */
  }
}

// First day of the week for the planner calendar: 1 = Monday (default), 0 = Sunday.
export const WEEK_START: Setting<0 | 1> = {
  key: 'week_start',
  read: (r) => (r === '0' ? 0 : 1),
  write: (v) => String(v),
}
export const getWeekStart = () => getSetting(WEEK_START)
export const setWeekStart = (v: 0 | 1) => setSetting(WEEK_START, v)

// Which view the planner opens on. Defaults to 'week' (the long-standing default).
export type PlannerView = 'month' | 'week' | 'list'
export const PLANNER_VIEW: Setting<PlannerView> = {
  key: 'planner_view',
  read: (r) => (r === 'month' || r === 'list' ? r : 'week'),
  write: (v) => v,
}
export const getPlannerView = () => getSetting(PLANNER_VIEW)
export const setPlannerView = (v: PlannerView) => setSetting(PLANNER_VIEW, v)

// --- Weight increment (A60) -------------------------------------------------

// Opt-in custom step size for the +/− buttons on active-session weight inputs
// (standard, additional and hang weight). Off by default; when off the steppers
// use the built-in default. Direct text entry is never restricted — this only
// governs the button step. Stored as a number ('weightIncrement') plus a boolean
// flag ('weightIncrementEnabled').
export const DEFAULT_WEIGHT_STEP = 0.5 // kg (the app is currently kg-only)

export const WEIGHT_INCREMENT_ENABLED = boolDefaultOff('weightIncrementEnabled')
export const getWeightIncrementEnabled = () => getSetting(WEIGHT_INCREMENT_ENABLED)
export const setWeightIncrementEnabled = (on: boolean) => setSetting(WEIGHT_INCREMENT_ENABLED, on)

// The configured increment (a positive number, ≤2dp). Falls back to the default
// step when unset or invalid.
export function getWeightIncrement(): number {
  try {
    const raw = localStorage.getItem('weightIncrement')
    if (raw == null) return DEFAULT_WEIGHT_STEP
    const v = Number(raw)
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_WEIGHT_STEP
  } catch {
    return DEFAULT_WEIGHT_STEP
  }
}
export function setWeightIncrement(n: number): void {
  try {
    // Clamp to a positive value with at most two decimal places.
    const v = Math.round(Math.max(0, n) * 100) / 100
    if (v > 0) localStorage.setItem('weightIncrement', String(v))
  } catch {
    /* ignore */
  }
}

// The step the weight +/− buttons should use right now: the configured increment
// when enabled, otherwise the built-in default.
export function getWeightStep(): number {
  return getWeightIncrementEnabled() ? getWeightIncrement() : DEFAULT_WEIGHT_STEP
}

// Pre-count ("Get ready") seconds before a timed exercise countdown (A30).
// 0 disables it. Clamped 0–10, defaults to 5.
export const PRECOUNT_SECONDS = intSetting('precountSeconds', 5, 0, 10)
export const getPrecountSeconds = () => getSetting(PRECOUNT_SECONDS)
export const setPrecountSeconds = (n: number) => setSetting(PRECOUNT_SECONDS, n)

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

// --- Default gym / board (A51) ---------------------------------------------

// Gym and board sessions can have a saved default location; when set, a session
// starts with that name pre-applied and no prompt. Crags never have a default.
export type DefaultLocationType = 'gym' | 'board'
const DEFAULT_KEYS: Record<DefaultLocationType, string> = {
  gym: 'default_gym',
  board: 'default_board',
}

export function getDefaultLocation(type: DefaultLocationType): string {
  try {
    return localStorage.getItem(DEFAULT_KEYS[type]) ?? ''
  } catch {
    return ''
  }
}
export function setDefaultLocation(type: DefaultLocationType, name: string): void {
  try {
    const n = name.trim()
    if (n) localStorage.setItem(DEFAULT_KEYS[type], n)
    else localStorage.removeItem(DEFAULT_KEYS[type])
  } catch {
    /* ignore */
  }
}
export function clearDefaultLocation(type: DefaultLocationType): void {
  try {
    localStorage.removeItem(DEFAULT_KEYS[type])
  } catch {
    /* ignore */
  }
}

// --- Gym grade ranges (A21) -------------------------------------------------

export type GymStyle = 'bouldering' | 'top_rope' | 'lead'
export interface GradeRange {
  min: number
  max: number
}
export type GymGradeRanges = Record<GymStyle, GradeRange>

// Fallback range when a gym has no saved config (F25 revised this from 0–35 to
// 1–10). Stored per-gym configs are untouched; only this default changes.
const DEFAULT_GYM_RANGES: GymGradeRanges = {
  bouldering: { min: 1, max: 10 },
  top_rope: { min: 1, max: 10 },
  lead: { min: 1, max: 10 },
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

// Per-gym grade ranges (A22), keyed by gym name. Unknown gyms default to 1–10 (F25).
export function getGymGradeRanges(gym: string): GymGradeRanges {
  return parseRanges(getAllGymGradeRanges()[gym])
}
export function setGymGradeRanges(gym: string, ranges: GymGradeRanges): void {
  const all = getAllGymGradeRanges()
  all[gym] = ranges
  writeAllGymGradeRanges(all)
}

// --- Gym areas / sections (A69, A83) ---------------------------------------
// Per-gym named areas (e.g. "Cave", "Slab wall"), keyed by gym name. Each area
// may carry a default height (m) and wall character (A83), pre-filled in the log
// sheet when the area is selected. Legacy entries were bare name strings.

export interface GymArea {
  name: string
  defaultHeightMetres?: number
  defaultCharacter?: ClimbCharacter
  defaultAngleDegrees?: number // F48 — numeric wall angle (0–90), pre-fills the log sheet
}

function toGymArea(a: unknown): GymArea | null {
  if (typeof a === 'string') return a.trim() ? { name: a } : null
  if (a && typeof a === 'object') {
    const o = a as Partial<GymArea>
    if (typeof o.name === 'string' && o.name.trim()) {
      return {
        name: o.name,
        defaultHeightMetres:
          typeof o.defaultHeightMetres === 'number' ? o.defaultHeightMetres : undefined,
        defaultCharacter: o.defaultCharacter,
        defaultAngleDegrees:
          typeof o.defaultAngleDegrees === 'number' ? o.defaultAngleDegrees : undefined,
      }
    }
  }
  return null
}

function getAllGymAreas(): Record<string, GymArea[]> {
  try {
    const p = JSON.parse(localStorage.getItem('gym_areas') ?? '{}')
    if (!p || typeof p !== 'object') return {}
    const out: Record<string, GymArea[]> = {}
    for (const [gym, list] of Object.entries(p)) {
      if (Array.isArray(list)) out[gym] = list.map(toGymArea).filter((x): x is GymArea => x != null)
    }
    return out
  } catch {
    return {}
  }
}
function writeAllGymAreas(all: Record<string, GymArea[]>): void {
  try {
    localStorage.setItem('gym_areas', JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
// Full area objects for a gym (Settings editor + log-sheet defaults).
export function getGymAreaList(gym: string): GymArea[] {
  return getAllGymAreas()[gym] ?? []
}
// Area names only — backward-compatible for the log-sheet pills + area filter.
export function getGymAreas(gym: string): string[] {
  return getGymAreaList(gym).map((a) => a.name)
}
// One area's config by name (A83 — its defaults pre-fill the log sheet).
export function getGymArea(gym: string, name: string): GymArea | undefined {
  return getGymAreaList(gym).find((a) => a.name.toLowerCase() === name.toLowerCase())
}
function setGymAreaList(gym: string, areas: GymArea[]): void {
  const all = getAllGymAreas()
  const clean = areas.filter((a) => a.name.trim())
  if (clean.length) all[gym] = clean
  else delete all[gym]
  writeAllGymAreas(all)
}
export function addGymArea(gym: string, name: string): GymArea[] {
  const n = name.trim()
  if (!n) return getGymAreaList(gym)
  const cur = getGymAreaList(gym)
  if (cur.some((x) => x.name.toLowerCase() === n.toLowerCase())) return cur
  const next = [...cur, { name: n }]
  setGymAreaList(gym, next)
  return next
}
export function removeGymArea(gym: string, name: string): GymArea[] {
  const next = getGymAreaList(gym).filter((x) => x.name !== name)
  setGymAreaList(gym, next)
  return next
}
export function renameGymArea(gym: string, oldName: string, newName: string): GymArea[] {
  const n = newName.trim()
  if (!n) return getGymAreaList(gym)
  const seen = new Set<string>()
  const next = getGymAreaList(gym)
    .map((x) => (x.name === oldName ? { ...x, name: n } : x))
    .filter((x) => {
      const k = x.name.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  setGymAreaList(gym, next)
  return next
}
// Set an area's default height / character (A83). Pass undefined to clear one.
export function updateGymAreaDefaults(
  gym: string,
  name: string,
  patch: { defaultHeightMetres?: number; defaultCharacter?: ClimbCharacter; defaultAngleDegrees?: number },
): GymArea[] {
  const next = getGymAreaList(gym).map((a) => (a.name === name ? { ...a, ...patch } : a))
  setGymAreaList(gym, next)
  return next
}

// --- Custom climb styles (A72) ---------------------------------------------
// User-defined style tags appended after the fixed CLIMB_STYLE_TAGS list.

export function getCustomClimbStyles(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem('custom_climb_styles') ?? '[]')
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function writeCustomClimbStyles(list: string[]): void {
  try {
    localStorage.setItem('custom_climb_styles', JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
export function addCustomClimbStyle(name: string): string[] {
  const n = name.trim()
  if (!n) return getCustomClimbStyles()
  const lc = n.toLowerCase()
  const cur = getCustomClimbStyles()
  // Reject collisions with an existing custom style OR a fixed tag (value or its
  // display label), so a style never renders as a duplicate pill.
  const fixedHit = CLIMB_STYLE_TAGS.some(
    (t) => t.toLowerCase() === lc || climbStyleLabel(t).toLowerCase() === lc,
  )
  if (fixedHit || cur.some((x) => x.toLowerCase() === lc)) return cur
  const next = [...cur, n]
  writeCustomClimbStyles(next)
  return next
}
export function removeCustomClimbStyle(name: string): string[] {
  const next = getCustomClimbStyles().filter((x) => x !== name)
  writeCustomClimbStyles(next)
  return next
}

// Keep the MRU name list and per-gym ranges in sync on rename / delete.
export function deleteGym(name: string): string[] {
  const areas = getAllGymAreas()
  if (name in areas) {
    delete areas[name]
    writeAllGymAreas(areas)
  }
  const all = getAllGymGradeRanges()
  if (name in all) {
    delete all[name]
    writeAllGymGradeRanges(all)
  }
  // A deleted gym can't stay the default (A51).
  if (getDefaultLocation('gym').toLowerCase() === name.toLowerCase()) clearDefaultLocation('gym')
  return removeSavedLocation('gym', name)
}
export function renameGym(oldName: string, newName: string): string[] {
  const n = newName.trim()
  if (!n || n === oldName) return getSavedLocations('gym')
  // Migrate the source gym's settings onto the new name, but never overwrite a
  // gym that already owns that name (rename-onto-existing keeps the target's own).
  const all = getAllGymGradeRanges()
  if (all[oldName]) {
    if (!(n in all)) all[n] = all[oldName]
    delete all[oldName]
    writeAllGymGradeRanges(all)
  }
  const areas = getAllGymAreas()
  if (areas[oldName]) {
    if (!(n in areas)) areas[n] = areas[oldName]
    delete areas[oldName]
    writeAllGymAreas(areas)
  }
  // Keep the default pointing at the renamed gym (A51).
  if (getDefaultLocation('gym').toLowerCase() === oldName.toLowerCase()) setDefaultLocation('gym', n)
  return renameSavedLocation('gym', oldName, n)
}

// Remove a saved board. Boards carry no per-location config (unlike gyms), so this
// just drops the name and clears the default if it pointed here. Session history is
// unaffected — logged sessions keep their own board name (F42).
export function deleteBoard(name: string): string[] {
  if (getDefaultLocation('board').toLowerCase() === name.toLowerCase()) clearDefaultLocation('board')
  return removeSavedLocation('board', name)
}

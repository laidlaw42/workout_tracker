import { useSyncExternalStore } from 'react'

// A tiny typed key/value store over localStorage for the app's flat UI settings
// (the on/off toggles and numeric prefs). Each Setting owns its localStorage key,
// how to read/write it, and its default in one place — so keys and defaults live
// in a single registry, writes are observable, and the logic is unit-testable and
// backend-swappable. Structured-list settings (saved gyms/boards, gym areas,
// grade ranges, route colours) keep their own domain modules; this is for flat
// values only.

export interface Setting<T> {
  key: string
  // Parse a raw localStorage value (null when unset) into T, applying the default.
  read: (raw: string | null) => T
  // Serialise T to a string, or return null to remove the key.
  write: (value: T) => string | null
}

// --- Codec helpers ---------------------------------------------------------

// A boolean that is ON unless explicitly '0' (the app's default-on convention).
export function boolDefaultOn(key: string): Setting<boolean> {
  return { key, read: (r) => r !== '0', write: (v) => (v ? '1' : '0') }
}
// A boolean that is OFF unless explicitly '1'.
export function boolDefaultOff(key: string): Setting<boolean> {
  return { key, read: (r) => r === '1', write: (v) => (v ? '1' : '0') }
}
// A clamped integer with a fallback default.
export function intSetting(
  key: string,
  def: number,
  min: number,
  max: number,
): Setting<number> {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)))
  return {
    key,
    read: (r) => {
      if (r == null) return def
      const v = Number(r)
      return Number.isFinite(v) ? clamp(v) : def
    },
    write: (v) => String(clamp(v)),
  }
}

// --- Reactivity ------------------------------------------------------------

const subscribers = new Set<() => void>()
let storageBound = false

function bindStorageEvent() {
  if (storageBound || typeof window === 'undefined') return
  storageBound = true
  window.addEventListener('storage', () => subscribers.forEach((fn) => fn()))
}

function subscribe(cb: () => void): () => void {
  bindStorageEvent()
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

// --- Access ----------------------------------------------------------------

export function getSetting<T>(s: Setting<T>): T {
  try {
    return s.read(localStorage.getItem(s.key))
  } catch {
    return s.read(null)
  }
}

export function setSetting<T>(s: Setting<T>, value: T): void {
  try {
    const raw = s.write(value)
    if (raw === null) localStorage.removeItem(s.key)
    else localStorage.setItem(s.key, raw)
  } catch {
    /* ignore storage errors */
  }
  // Notify same-tab subscribers (the 'storage' event only fires cross-tab).
  subscribers.forEach((fn) => fn())
}

// Reactive read: a component using this re-renders when the setting changes
// (in this tab via setSetting, or cross-tab via the storage event).
export function useSetting<T>(s: Setting<T>): T {
  return useSyncExternalStore(
    subscribe,
    () => getSetting(s),
    () => getSetting(s),
  )
}

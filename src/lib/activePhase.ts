// Reload-resilient in-session timer state (F48).
//
// The active-set flow — pre-count → hold/hang countdown → auto-log → rest →
// (auto-advance) — lives entirely in React memory (the timer hooks + refs). If
// the session screen is torn down and remounted (an iOS PWA reload on resume, a
// dev/preview reload, or just navigating away and back), all of it is lost: the
// countdown/rest stop and the auto-advance chain never fires, so the session
// looks stuck on the current set with no pre-count.
//
// To survive that, each screen persists a tiny descriptor of the *currently
// running* phase (which item, which phase, and its absolute end time) here, and
// re-arms it on mount. Kept in localStorage (synchronous, so the resume happens
// before first paint — no flash of the idle "Start" button) and keyed by session
// id so it never leaks between sessions. Cleared when the flow goes idle or the
// session ends.

export interface ActiveTimerPhase {
  // Which queue the running item belongs to.
  kind: 'exercise' | 'hang'
  // Stable identifier across a reload: an exercise's exerciseId (its working
  // `uid` is regenerated each mount) or a hang's hangSetId.
  ref: string
  phase: 'precount' | 'countdown' | 'rest'
  // Absolute wall-clock ms when the phase completes; drives the resumed timer's
  // remaining time and the staleness check.
  endsAt: number
}

const keyFor = (sessionId: string) => `active_phase_${sessionId}`

export function saveActivePhase(sessionId: string, phase: ActiveTimerPhase): void {
  if (!sessionId) return
  try {
    localStorage.setItem(keyFor(sessionId), JSON.stringify(phase))
  } catch {
    /* ignore storage errors */
  }
}

export function loadActivePhase(sessionId: string): ActiveTimerPhase | null {
  if (!sessionId) return null
  try {
    const raw = localStorage.getItem(keyFor(sessionId))
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<ActiveTimerPhase>
    if (
      (p.kind === 'exercise' || p.kind === 'hang') &&
      typeof p.ref === 'string' &&
      (p.phase === 'precount' || p.phase === 'countdown' || p.phase === 'rest') &&
      typeof p.endsAt === 'number'
    ) {
      return p as ActiveTimerPhase
    }
    return null
  } catch {
    return null
  }
}

export function clearActivePhase(sessionId: string): void {
  if (!sessionId) return
  try {
    localStorage.removeItem(keyFor(sessionId))
  } catch {
    /* ignore storage errors */
  }
}

// A persisted phase older than this (relative to its endsAt) is treated as stale
// and never auto-resumed — so re-opening a long-abandoned unfinished session
// doesn't spontaneously fire a countdown. Generous enough to cover the longest
// hangboard rest (300s) plus real background time.
export const RESUME_GRACE_MS = 10 * 60 * 1000

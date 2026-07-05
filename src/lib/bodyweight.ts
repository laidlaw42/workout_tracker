const KEY = 'bodyweight'

// User bodyweight in kg (A38). Null when unset. Drives the % of bodyweight shown
// on active-session weight inputs (A39). kg-only — no units toggle exists yet.
export function getBodyweight(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw.trim() === '') return null
    const v = Number(raw)
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function setBodyweight(kg: number | null): void {
  try {
    if (kg != null && Number.isFinite(kg) && kg > 0) localStorage.setItem(KEY, String(kg))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage errors */
  }
}

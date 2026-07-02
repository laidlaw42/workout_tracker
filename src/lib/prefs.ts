// Small UI preferences kept in localStorage.

const AUTO_ADVANCE_KEY = 'auto_advance_timed'

// Whether the rest timer auto-starts the next timed set's countdown on expiry.
// Defaults ON (only an explicit '0' disables it).
export function getAutoAdvance(): boolean {
  try {
    return localStorage.getItem(AUTO_ADVANCE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setAutoAdvance(on: boolean): void {
  try {
    localStorage.setItem(AUTO_ADVANCE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

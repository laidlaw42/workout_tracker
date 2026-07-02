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

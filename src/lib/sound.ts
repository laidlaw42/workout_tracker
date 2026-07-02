// Web Audio beeps — no audio assets. The context is created/resumed lazily on
// first use; since every call originates from a user gesture (tapping Start /
// logging a set), the browser autoplay policy is satisfied.

import { getTimerSounds } from './prefs'

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, durationMs: number) {
  const ac = audioCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const now = ac.currentTime
  const end = now + durationMs / 1000
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(now)
  osc.stop(end + 0.03)
}

/** Short high beep for the 4/3/2/1 countdown ticks. */
export function playTick() {
  if (!getTimerSounds()) return
  tone(880, 90)
}

/** Lower, longer tone for reaching zero. */
export function playComplete() {
  if (!getTimerSounds()) return
  tone(660, 280)
}

/** Higher, distinct tone at the final pre-count second — imminent start (A30). */
export function playPrecountGo() {
  if (!getTimerSounds()) return
  tone(1175, 150)
}

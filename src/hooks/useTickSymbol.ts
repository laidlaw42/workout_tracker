import { useSyncExternalStore } from 'react'
import { getTickDisplayStyle, TICK_STYLE_EVENT } from '@/lib/prefs'
import { tickIndicator, type TickDisplayStyle } from '@/lib/tickTypes'
import type { ClimbingTick } from '@/types'

function subscribe(cb: () => void): () => void {
  window.addEventListener(TICK_STYLE_EVENT, cb)
  window.addEventListener('storage', cb) // cross-tab
  return () => {
    window.removeEventListener(TICK_STYLE_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// The active tick-indicator style (A49), reactive to the Settings toggle so a
// change takes effect everywhere at once.
export function useTickDisplayStyle(): TickDisplayStyle {
  return useSyncExternalStore(subscribe, getTickDisplayStyle, () => 'emojis')
}

// Indicator for a single tick. Components rendering many ticks in a loop should
// call useTickDisplayStyle() once and use tickIndicator() to avoid hook-in-loop.
export function useTickSymbol(tick: ClimbingTick): string {
  return tickIndicator(tick, useTickDisplayStyle())
}

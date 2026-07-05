import type { ClimbingTick } from '@/types'

// Per-tick indicators shown beside the tick label (A49). Two maps — a Unicode
// "symbols" set and an "emojis" set — selectable in Settings. Keep both in sync
// with the ClimbingTick union and the TICK_TYPES definitions in `climbing.ts`.

// Unicode symbols, meant to render in a fixed-width span.
export const TICK_SYMBOLS: Record<ClimbingTick, string> = {
  onsight: '◎',
  flash: '↯',
  send: '✓',
  clean: '✦',
  redpoint: '●',
  pink_point: '◉',
  hang_dog: '↓',
  working: '◐',
  repeat: '↺',
  attempt: '○',
  retreat: '✕',
  dab: '·',
}

export const TICK_EMOJIS: Record<ClimbingTick, string> = {
  onsight: '👁️',
  flash: '⚡',
  send: '✅',
  clean: '✨',
  redpoint: '🔴',
  pink_point: '🩷',
  hang_dog: '🐕',
  working: '🔧',
  repeat: '🔁',
  attempt: '🔄',
  retreat: '🚫',
  dab: '👆',
}

export type TickDisplayStyle = 'symbols' | 'emojis'

export function tickIndicator(tick: ClimbingTick, style: TickDisplayStyle): string {
  return (style === 'symbols' ? TICK_SYMBOLS : TICK_EMOJIS)[tick]
}

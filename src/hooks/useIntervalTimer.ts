import { useEffect, useMemo, useRef } from 'react'
import type { IntervalBlock } from '@/types'

export interface FlatStep {
  label: string
  duration: number
}

export interface IntervalTimer {
  steps: FlatStep[]
  currentIndex: number
  current: FlatStep | undefined
  remainingInStep: number
  totalElapsed: number
  finished: boolean
  hasIntervals: boolean
}

function flatten(blocks: IntervalBlock[]): FlatStep[] {
  const out: FlatStep[] = []
  for (const block of blocks) {
    for (let r = 0; r < block.repeat; r++) {
      for (const step of block.steps) {
        out.push({ label: step.label, duration: step.durationSeconds })
      }
    }
  }
  return out
}

// Auto-advancing interval timer driven by the session's elapsed seconds, so it
// pauses/resumes together with the session clock.
export function useIntervalTimer(
  blocks: IntervalBlock[],
  elapsedSeconds: number,
): IntervalTimer {
  const steps = useMemo(() => flatten(blocks), [blocks])
  const cumulativeEnds = useMemo(() => {
    const ends: number[] = []
    let acc = 0
    for (const s of steps) {
      acc += s.duration
      ends.push(acc)
    }
    return ends
  }, [steps])

  let idx = cumulativeEnds.findIndex((end) => elapsedSeconds < end)
  const finished = steps.length > 0 && idx === -1
  if (idx === -1) idx = Math.max(0, steps.length - 1)

  const remainingInStep = finished ? 0 : Math.max(0, cumulativeEnds[idx] - elapsedSeconds)

  // Haptic on each interval change (no-op on iOS Safari).
  const prevIdx = useRef(idx)
  useEffect(() => {
    if (steps.length > 0 && idx !== prevIdx.current) {
      prevIdx.current = idx
      navigator.vibrate?.([200])
    }
  }, [idx, steps.length])

  return {
    steps,
    currentIndex: idx,
    current: steps[idx],
    remainingInStep,
    totalElapsed: elapsedSeconds,
    finished,
    hasIntervals: steps.length > 0,
  }
}

import { useEffect, useRef } from 'react'
import { playPrecountGo, playTick } from '@/lib/sound'

// A tick beep on each pre-count second, with a distinct higher tone on the final
// second to signal the exercise is about to start (A30). Fires once per second.
export function usePrecountBeeps(remaining: number, active: boolean) {
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (!active) {
      last.current = null
      return
    }
    if (last.current === remaining) return
    last.current = remaining
    if (remaining === 1) playPrecountGo()
    else if (remaining > 1) playTick()
  }, [remaining, active])
}

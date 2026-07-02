import { useEffect, useRef } from 'react'
import { playComplete, playTick } from '@/lib/sound'

// Fires a tick beep as `remaining` enters 4/3/2/1 and a completion tone at 0,
// each once per transition. Shared by the rest timer and the set countdown.
export function useCountdownBeeps(remaining: number, active: boolean) {
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (!active) {
      last.current = null
      return
    }
    if (last.current === remaining) return
    last.current = remaining
    if (remaining > 0 && remaining <= 4) playTick()
    else if (remaining === 0) playComplete()
  }, [remaining, active])
}

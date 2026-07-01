import { useEffect, useState } from 'react'

// Elapsed seconds since `startedAt`, derived from Date.now() on each tick — never
// an accumulated counter, so lock-screen / background throttling can't make it drift.
export function useElapsedTimer(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

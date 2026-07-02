import { useEffect } from 'react'

// Holds a screen wake lock while `enabled`, so the phone doesn't sleep during a
// workout. The lock is auto-released by the browser when the page is hidden, so
// we re-acquire it on visibility change. No-op where the API is unsupported
// (e.g. older iOS) or outside a secure context.
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const nav = navigator as Navigator & { wakeLock?: WakeLock }
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen')
        if (cancelled) {
          void lock.release().catch(() => {})
        } else {
          sentinel = lock
        }
      } catch {
        /* rejected (not visible, unsupported) — ignore */
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && sentinel === null) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [enabled])
}

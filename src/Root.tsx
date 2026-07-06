import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from '@/db/seed'
import { migrateHomeVenueToBoard, migrateWallAngles, syncAllTagMeta } from '@/db/helpers'
import { completeConnectFromRedirect, initScheduledBackups, providerLabel } from '@/lib/backup'

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      <p className="animate-pulse text-sm">Loading…</p>
    </div>
  )
}

// One-time DB bootstrap before the app renders. seedIfNeeded() is idempotent,
// so StrictMode's double-invoke in dev is harmless.
export function Root() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    seedIfNeeded()
      // Backfill tag metadata for seeded/imported tags (A35), best-effort.
      .then(() => syncAllTagMeta().catch((err) => console.error('Tag sync failed', err)))
      // Migrate legacy wallAngle → climbCharacter (A45), best-effort.
      .then(() => migrateWallAngles().catch((err) => console.error('Wall-angle migration failed', err)))
      // Migrate board venue 'home' → 'board' (F30), best-effort.
      .then(() =>
        migrateHomeVenueToBoard().catch((err) => console.error('Board-venue migration failed', err)),
      )
      .catch((err) => console.error('Seeding failed', err))
      .finally(() => setReady(true))
  }, [])

  // A89 — complete a cloud OAuth sign-in redirect, then arm the daily backup
  // schedule (which also runs an overdue backup immediately). Best-effort.
  useEffect(() => {
    completeConnectFromRedirect()
      .then((provider) => {
        if (provider) toast.success(`Connected ${providerLabel(provider)}`)
      })
      .catch((err) => toast.error((err as Error)?.message ?? 'Sign-in failed'))
    let cleanup = () => {}
    try {
      cleanup = initScheduledBackups()
    } catch (err) {
      console.error('Backup schedule init failed', err)
    }
    return cleanup
  }, [])

  if (!ready) return <LoadingScreen />
  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  )
}

import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from '@/db/seed'
import { migrateHomeVenueToBoard, migrateWallAngles, syncAllTagMeta } from '@/db/helpers'

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

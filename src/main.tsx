import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from '@/db/seed'
import './index.css'

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      <p className="animate-pulse text-sm">Loading…</p>
    </div>
  )
}

function Root() {
  // One-time DB bootstrap before the app renders. seedIfNeeded() is idempotent,
  // so StrictMode's double-invoke in dev is harmless.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    seedIfNeeded()
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

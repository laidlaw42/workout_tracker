import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from '@/db/seed'
import './index.css'

const root = createRoot(document.getElementById('root')!)

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      <p className="animate-pulse text-sm">Loading…</p>
    </div>
  )
}

// Seed the DB on first run before the app mounts, showing a brief loading state.
root.render(
  <StrictMode>
    <LoadingScreen />
  </StrictMode>,
)

void (async () => {
  try {
    await seedIfNeeded()
  } catch (err) {
    console.error('Seeding failed', err)
  }
  root.render(
    <StrictMode>
      <BrowserRouter
        basename={import.meta.env.BASE_URL}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})()

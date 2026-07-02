import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './Root'
import { applyTheme, getTheme } from './lib/theme'
import './index.css'

// Re-apply the (validated) theme on boot so a stored id that has since been
// removed heals to Dark and rewrites localStorage. The pre-paint script in
// index.html handles the flash-free initial paint.
applyTheme(getTheme())

// Pure bootstrap only — no component definitions here, so Fast Refresh never
// re-runs createRoot when app code changes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

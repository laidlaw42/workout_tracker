import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { Root } from './Root'
import { applyTheme, getTheme } from './lib/theme'
import './index.css'

// Re-apply the (validated) theme on boot so a stored id that has since been
// removed heals to Dark and rewrites localStorage. The pre-paint script in
// index.html handles the flash-free initial paint.
applyTheme(getTheme())

// PWA updates (registerType: 'autoUpdate'). The default injected registration only
// *registers* the SW; with skipWaiting+clientsClaim the new SW claims the open page
// but the page keeps serving the OLD cached bundle until a manual reload — which is
// why stale-bundle bugs (e.g. a theme mismatch) previously needed a cache clear.
// registerSW from virtual:pwa-register uses workbox-window, so once a new version
// activates it reloads the page automatically (only on an update, not first visit).
registerSW({ immediate: true })

// Pure bootstrap only — no component definitions here, so Fast Refresh never
// re-runs createRoot when app code changes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

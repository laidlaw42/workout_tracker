import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './Root'
import './index.css'

// Pure bootstrap only — no component definitions here, so Fast Refresh never
// re-runs createRoot when app code changes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

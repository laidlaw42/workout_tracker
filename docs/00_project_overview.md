# Workout Tracker — Project Overview

## What we're building

A mobile-first Progressive Web App (PWA) for tracking strength workouts, cardio sessions, and climbing sessions. Designed for one user, runs entirely on-device, installable from Safari on iPhone with no App Store or Apple Developer account required.

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 19 + TypeScript | Excellent mobile support; matches shadcn's ref-as-prop components |
| Build tool | Vite | Fast dev server, first-class PWA plugin |
| Styling | Tailwind CSS v4 | Utility-first, mobile-first; CSS-first config via `@tailwindcss/vite` |
| Components | shadcn/ui | Accessible, unstyled-first, copy-paste |
| Database | Dexie.js (IndexedDB) | Clean API over browser IndexedDB, offline-first |
| PWA | vite-plugin-pwa | Auto service worker + manifest generation |
| Routing | React Router v6 | Standard SPA routing |
| Icons | Lucide React | Consistent, tree-shakeable |
| Charts | Hand-rolled SVG | Tiny, theme-aware; no chart-library dependency (D2) |
| Drag & drop | @dnd-kit | Accessible sortable lists (template editor) |
| Hosting | GitHub Pages | Free static hosting at the `/workout_tracker/` subpath; CI via GitHub Actions |

## Repository layout

```
workout_tracker/
├── docs/                     # ← you are here
├── public/
│   └── icons/                # PWA icons (192, 512, maskable)
├── src/
│   ├── db/                   # Dexie schema (db.ts) + typed helpers (helpers.ts) + seed.ts
│   ├── components/           # Shared UI components
│   ├── screens/              # One folder per top-level screen
│   ├── hooks/                # Custom React hooks (useTimer, useSession, etc.)
│   ├── lib/                  # Pure utilities (id.ts, formatDuration.ts, grade/volume calc)
│   ├── types/                # Shared TypeScript types
│   ├── index.css             # Tailwind v4 entry: @import + theme CSS variables
│   └── main.tsx
├── .github/workflows/        # deploy.yml for GitHub Pages
├── components.json           # shadcn/ui config
├── index.html
├── vite.config.ts            # base, aliases, Tailwind v4, PWA
└── package.json
```

> Tailwind v4 is configured in `src/index.css` (CSS-first), so there is no `tailwind.config.ts`.

## Three discipline types

The app tracks three distinct activity types, each with its own data model and session flow:

1. **Strength** — pre-built templates with exercises, sets, reps, rest times. Mid-session modification (add/swap/skip/remove/reorder) and an auto rest timer.
2. **Cardio** — duration, distance, pace. Optional interval structure, editable mid-session.
3. **Climbing** — gym/crag/board route logging (bouldering V-grade + roped Ewbanks with theCrag tick types) and **hangboard** protocols (grip/edge/duration sets), which have their own exercise category and library tab. Hangboard sessions log on the training screen (A73).

A build-from-scratch session that ends up spanning more than one discipline (e.g. strength + hangs) is typed **'mixed'** (A66).

## Planning & personalisation

- **Planner** — a calendar tab (week / month / list views) to schedule workouts from the template library; finishing a matching session auto-links it to its plan.
- **Themes** — 22 built-in light/dark themes (11 families) chosen from a preview-swatch dropdown in Settings, applied via `data-theme` on `<html>`.
- **Data tools** — JSON export, replace-import, non-destructive merge-import, "restore defaults" (re-seed missing built-ins), and a two-step "clear all data".

## Core design constraints

- Offline-first: every feature must work with no internet after first install
- iPhone viewport: all interactive targets ≥ 44px, safe area insets respected
- No accounts, no backend, no cloud sync (v1)
- JSON export/import (replace or merge) for backup and restore
- 22 light/dark themes; UI preferences (theme, name, session toggles, week start, pre-count, saved gyms/crags/boards, per-gym grade ranges) persist in `localStorage`; all workout data in IndexedDB
- Weights are stored and entered in **kg only** in v1 (no unit toggle)
- Requires a secure context (HTTPS or `localhost`) for the service worker and `crypto` — on-device LAN testing uses a dev HTTPS cert (`vite-plugin-mkcert`)

## Guiding conventions for Claude

- All components are functional with named exports
- No default exports except page-level screen components
- Tailwind only — no inline styles, no CSS modules
- All Dexie operations — reads and writes — go through `src/db/` helper functions, never called directly from components. Live reads use `useLiveQuery(() => someHelper())` so components never import `db`.
- All TypeScript types live in `src/types/index.ts` unless screen-specific
- Commits are descriptive: `feat(db): add sessions table and typed helpers`

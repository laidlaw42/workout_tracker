# Workout Tracker — Project Overview

## What we're building

A mobile-first Progressive Web App (PWA) for tracking strength workouts, cardio sessions, and climbing sessions. Designed for one user, runs entirely on-device, installable from Safari on iPhone with no App Store or Apple Developer account required.

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Familiar stack, excellent mobile support |
| Build tool | Vite | Fast dev server, first-class PWA plugin |
| Styling | Tailwind CSS v3 | Utility-first, mobile-first by default |
| Components | shadcn/ui | Accessible, unstyled-first, copy-paste |
| Database | Dexie.js (IndexedDB) | Clean API over browser IndexedDB, offline-first |
| PWA | vite-plugin-pwa | Auto service worker + manifest generation |
| Routing | React Router v6 | Standard SPA routing |
| Icons | Lucide React | Consistent, tree-shakeable |
| Hosting | GitHub Pages | Free, static, CI via GitHub Actions |

## Repository layout

```
workout_tracker/
├── docs/                     # ← you are here
├── public/
│   └── icons/                # PWA icons (192, 512, maskable)
├── src/
│   ├── db/                   # Dexie schema + typed table helpers
│   ├── components/           # Shared UI components
│   ├── screens/              # One folder per top-level screen
│   ├── hooks/                # Custom React hooks (useTimer, useSession, etc.)
│   ├── lib/                  # Pure utility functions (grade conversion, volume calc)
│   ├── types/                # Shared TypeScript types
│   └── main.tsx
├── .github/workflows/        # deploy.yml for GitHub Pages
├── index.html
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

## Three discipline types

The app tracks three distinct activity types, each with its own data model and session flow:

1. **Strength** — pre-built templates with exercises, sets, reps, rest times. Mid-session modification allowed.
2. **Cardio** — duration, distance, pace. Optional interval structure.
3. **Climbing** — bouldering (V-grade) and roped (Ewbanks). Per-route tick logging with theCrag tick types.

## Core design constraints

- Offline-first: every feature must work with no internet after first install
- iPhone viewport: all interactive targets ≥ 44px, safe area insets respected
- No accounts, no backend, no cloud sync (v1)
- JSON export/import for backup and restore
- Dark mode supported throughout

## Guiding conventions for Claude

- All components are functional with named exports
- No default exports except page-level screen components
- Tailwind only — no inline styles, no CSS modules
- All Dexie operations go through `src/db/` helper functions, never called directly from components
- All TypeScript types live in `src/types/index.ts` unless screen-specific
- Commits are descriptive: `feat(db): add sessions table and typed helpers`
- Each phase ends with a working, installable app — no half-built phases

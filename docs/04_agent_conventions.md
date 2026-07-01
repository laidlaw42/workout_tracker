# Agent Conventions

Standing instructions for Claude when working on this project. Apply these across every phase without being told.

---

## Code style

- TypeScript strict mode — no `any`, no implicit returns in non-void functions
- Functional components only — no class components
- Named exports for all components and hooks; default export only for screen-level components
- Props interfaces defined inline above the component: `interface Props { ... }`
- No inline styles — Tailwind classes only
- Tailwind class order: layout → sizing → spacing → typography → colour → state (`hover:`, `dark:`)
- All colours via Tailwind tokens or CSS variables — no hardcoded hex in JSX
- shadcn/ui components preferred over hand-rolling common patterns (dialogs, sheets, inputs, selects)

## File naming

- Components: PascalCase — `ExerciseCard.tsx`
- Hooks: camelCase with `use` prefix — `useRestTimer.ts`
- Utilities: camelCase — `units.ts`, `formatDuration.ts`
- Screens: PascalCase with `Screen` suffix — `HomeScreen.tsx`

## Database rules

- All Dexie operations go through `src/db/helpers.ts` — never import `db` directly into a component
- All live queries use `useLiveQuery` from `dexie-react-hooks`
- All IDs generated with `crypto.randomUUID()`
- All timestamps in milliseconds via `Date.now()`

## Error handling

- Wrap all DB helper functions in try/catch; re-throw with descriptive message
- Show shadcn `toast` (sonner) on DB errors — never silent failures
- Loading states: use `useLiveQuery`'s undefined return to show a `<Skeleton>` placeholder

## Commits

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `style`, `chore`
Scopes: `db`, `home`, `library`, `session`, `climbing`, `cardio`, `progress`, `settings`, `pwa`

Examples:
- `feat(db): add climbing tables and route helpers`
- `feat(session): implement rest timer with haptic feedback`
- `fix(climbing): filter tick types correctly for top rope vs lead`

## When modifying existing code

- Read the file before editing — do not assume current content
- Preserve existing imports; add new ones at the top grouped: React → libraries → local
- Do not remove or rename exports that other files depend on without searching for usages first
- If a change requires updating multiple files, complete all of them in the same response

## What not to do

- Do not install or use: Redux, MobX, Zustand, or any global state library — React state + Dexie live queries are sufficient
- Do not use `useEffect` to fetch data — use `useLiveQuery` instead
- Do not use `localStorage` for anything except `units` preference and `db_seeded` flag
- Do not add authentication, user accounts, or any network calls in v1
- Do not use `any` as a TypeScript escape hatch — define the type properly
- Do not leave console.log statements in committed code
- Do not add placeholder comments like `// TODO: implement this` — implement it or omit the stub

## Reporting at end of each phase

After completing a phase, provide a brief summary:
1. Files created or modified (with paths)
2. Any decisions made that deviated from the spec (and why)
3. Anything the reviewer should manually verify on-device
4. npm packages added (if any)

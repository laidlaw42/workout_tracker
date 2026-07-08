# Agent Conventions

Standing instructions for Claude when working on this project. Apply these on every task without being told.

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
- Utilities: camelCase — `id.ts`, `formatDuration.ts`
- Screens: PascalCase with `Screen` suffix — `HomeScreen.tsx`

## Database rules

- All Dexie operations — reads and writes — go through `src/db/helpers.ts`; never import `db` directly into a component
- Live queries use `useLiveQuery` from `dexie-react-hooks`, always wrapping a helper: `useLiveQuery(() => getRecentSessions(5), [deps])` — the querier calls a helper, never `db`
- Every read a screen needs has a corresponding helper; if one is missing, add it to `helpers.ts` rather than reaching into `db`
- All IDs generated via `generateId()` from `src/lib/id.ts` (wraps `crypto.randomUUID()` with a fallback for non-secure contexts) — never call `crypto.randomUUID()` directly
- All timestamps in milliseconds via `Date.now()`; countdown/elapsed timers derive from timestamp deltas, never an accumulated counter (setInterval is throttled when backgrounded)

## Error handling

- Wrap DB helper functions in try/catch; re-throw with a descriptive message. Helpers stay UI-agnostic — they do NOT show toasts.
- Show shadcn `toast` (sonner) at the **call site** (the component/event handler) when a helper rejects — never silent failures
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
- Do not use `useEffect` to fetch data — use `useLiveQuery(() => helper())` instead (fine for one-shot loads too, e.g. loading a session by id)
- Do not use `localStorage` as a data store; v1 has no persistent UI prefs, and first-run seeding is detected from IndexedDB (`db.templates.count()`), not a flag
- Do not rely on `navigator.vibrate` for required feedback — it is a no-op on iOS Safari; haptics are progressive enhancement only
- Do not add authentication, user accounts, or any network calls in v1
- Do not use `any` as a TypeScript escape hatch — define the type properly
- Do not leave console.log statements in committed code
- Do not add placeholder comments like `// TODO: implement this` — implement it or omit the stub

## Reporting at end of a task

After completing a task, provide a brief summary:
1. Files created or modified (with paths)
2. Any decisions made that deviated from the spec (and why)
3. Anything the reviewer should manually verify on-device
4. npm packages added (if any)

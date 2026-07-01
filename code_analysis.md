# Code Analysis

A scan of the `workout_tracker` codebase for bugs, code smells, and technical
debt, done after the latest batch of features (Planner, themes, climbing fixes,
data tools). Nothing here is a release blocker — the app typechecks under strict
TypeScript, builds cleanly, and the flows were verified in-browser. Items are
grouped by severity with concrete locations and recommendations.

_Generated 2026-07-02._

---

## Summary

| Area | Count | Notes |
|---|---|---|
| Correctness / latent bugs | 3 | All minor / edge-case; no confirmed user-facing break |
| Maintainability / smells | 6 | Mostly small, localised |
| Performance | 2 | Fine for a single-user app; would matter at scale |
| Tooling / process | 2 | No linter; large JS chunk |

Healthy signs: no `console.log`/`TODO`/`FIXME`/`@ts-ignore`/`any`/`eslint-disable`
anywhere in `src/`, strict `tsconfig` (`noUnusedLocals`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`), a consistent DB-helper boundary (components never import
`db`), and static-string Tailwind classes throughout (no purge hazards).

---

## Correctness / latent bugs

### C1 — `clearAllData` removes a `db_seeded` key that is never used _(low)_
`src/db/helpers.ts:816`

`clearAllData()` calls `localStorage.removeItem('db_seeded')`, and the comment
(`:808`) implies a `db_seeded` flag gates seeding. It does not — `seedIfNeeded()`
tracks provenance entirely in the Dexie `meta` table (`seededExerciseIds`,
`seededTemplateIds`, `builtinRefreshVersion`). The `removeItem` is a harmless
no-op today, but the comment is misleading and could send a future reader looking
for a flag that doesn't exist. The actual re-seed mechanism is `meta` being
cleared (which `clearAllData` does).

**Recommendation:** drop the `db_seeded` line and reword the comment to point at
the `meta` table, or (if a localStorage guard is ever wanted) actually implement
it in `seedIfNeeded()`.

### C2 — `updatePlannedWorkout` relies on Dexie deleting `undefined` fields _(low)_
`src/screens/PlannerScreen.tsx` (`savePlanEdit`) → `helpers.ts` `updatePlannedWorkout`

Clearing a plan's time passes `plannedTimeOfDay: undefined`. This depends on
Dexie's behaviour of treating an `undefined` change value as "delete the key".
Setting a time was verified; clearing an existing time back to blank was not
exercised end-to-end. If Dexie semantics ever change, a stale time could persist.

**Recommendation:** add a quick test for clear-the-time, or explicitly delete the
key (e.g. read-modify-`put`) if you want to be defensive.

### C3 — Ewbanks colour band boundary differs from the request _(informational)_
`src/lib/climbing.ts` `ewbanksBandClass`

The request said "24–32 = red" and "19–24 = orange", which overlap at 24. The
implementation resolves this as 19–24 orange, **25**–32 red (24 belongs to
orange). Intentional and documented in `docs/05_reference.md`; noted here only so
the deviation from the literal spec is on record.

---

## Maintainability / code smells

### M1 — Dark-theme list is duplicated and `DARK_THEME_IDS` is dead _(medium)_
`index.html` (pre-paint script) vs `src/lib/theme.ts:42`

The set of "dark" theme ids exists in two places: the hand-maintained array in
the inline pre-paint script in `index.html`, and `DARK_THEME_IDS` in `theme.ts`.
They must be kept in sync by hand (a comment says so), and adding a theme means
editing both. Worse, `DARK_THEME_IDS` is **exported but never imported** anywhere
— it's dead code that only looks like it enforces the sync.

**Recommendation:** the inline script can't import ES modules, so full
de-duplication is hard, but at minimum: use `DARK_THEME_IDS` inside
`applyTheme`'s `isDark` so the export has a real consumer, or delete the export
and keep just the comment. Alternatively persist an `is-dark` boolean alongside
`theme` in `localStorage` and read that in the pre-paint script, removing the
list from `index.html` entirely.

### M2 — Two similar date-key helpers with different formats _(low)_
`src/lib/date.ts` — `dayKey` (unpadded `2026-7-1`, streaks) vs `toDateKey`
(zero-padded `2026-07-02`, planner)

Both produce a "local calendar day" string but in incompatible formats. They are
correctly used for different purposes (only the padded one sorts/range-queries
as a string), but the near-identical names invite accidental cross-use.

**Recommendation:** rename `dayKey` → `dayKeyUnpadded` (or migrate streak code to
`toDateKey`) so the distinction is obvious at call sites.

### M3 — Inconsistent `uid` generation for working exercise lists _(low)_
`StrengthSessionScreen` uses `generateId()` for `WorkExercise.uid`;
`ClimbingSessionScreen` `basePlanExercises` uses a deterministic
`` `${e.exerciseId}-${e.order}` ``.

Both work, but the two session screens now share the `WorkExercise`/`ModifySheet`
machinery, so the divergence is surprising. The deterministic form would collide
if a plan ever had two rows with the same `exerciseId` and `order` (not currently
possible, but not enforced).

**Recommendation:** use `generateId()` in both for consistency.

### M4 — `run()` error wrapper nests when helpers call helpers _(low)_
`src/db/helpers.ts` — e.g. `mergeData` → `redetectPRs` → `checkAndSavePR`

Helpers that call other helpers produce doubly-wrapped error messages
(`[db] mergeData failed: [db] checkAndSavePR failed: …`). Cosmetic only.

**Recommendation:** acceptable as-is; if it bothers, have internal callers use a
private un-wrapped variant.

### M5 — `PlannerScreen` sub-views are large inline components _(low)_
`src/screens/PlannerScreen.tsx` (~470 lines)

`WeekView`, `MonthView`, and `ListView` live in the same file as the screen. It's
readable, but the file is the largest in the project and mixes three distinct
layouts plus the edit dialog.

**Recommendation:** optional — split the three views into `components/planner/`
if the screen grows further.

### M6 — Denormalised names can drift on rename _(by design, worth documenting)_
`templateName` on sessions/plans, `exerciseName` on sets/hangs, `templateName`
on `PlannedWorkout` are all snapshots. `updateExercise` cascades renames to
templates but intentionally not to historical logs. A renamed template also won't
update the `templateName` shown on an already-scheduled `PlannedWorkout`.

**Recommendation:** none needed — this is a deliberate "history reflects what
happened" choice — but it's the kind of thing worth a one-line comment near the
`PlannedWorkout` type.

---

## Performance

### P1 — Planner loads *all* sessions on every render _(low)_
`src/screens/PlannerScreen.tsx` — `useLiveQuery(() => getAllSessions(), [])`

To build the "completed session" dots, the planner reads the entire sessions
table and re-runs on any change. Fine for a personal app with hundreds of
sessions; would grow unbounded over years of use.

**Recommendation:** if it ever matters, add a `getSessionsForRange(from, to)`
helper (sessions are indexed by `startedAt`) and query only the visible window,
as the planner already does for `plannedWorkouts`.

### P2 — Main JS chunk is ~675 KB (gzip ~200 KB) _(low)_
`dist/assets/index-*.js` (674 KB); the build prints the >500 KB warning.

`ProgressScreen` (recharts, ~382 KB) is already lazy-loaded, but the primary
chunk is still large — Dexie, React Router, @dnd-kit, and sonner all land in it.

**Recommendation:** optional — lazy-load the session/planner screens too, or set
`build.chunkSizeWarningLimit`. Not urgent for an installed offline PWA where the
service worker precaches everything on first load.

---

## Tooling / process

### T1 — No ESLint / Prettier configured _(medium)_
`package.json` has `typecheck`, `build`, `dev` — no `lint` or `format`.

Strict `tsc` catches type errors and unused locals, but not lint-class issues
(exhaustive-deps on hooks, accessibility, import ordering) or formatting drift.
The code is currently very consistent by hand, which won't scale with more
contributors.

**Recommendation:** add `eslint` with `eslint-plugin-react-hooks` and
`typescript-eslint`, plus Prettier, and a `lint` script. `react-hooks/exhaustive-deps`
in particular would have flagged nothing critical here but is cheap insurance.

### T2 — Tailwind dev-server can serve stale utility CSS for new files _(environmental, not a code bug)_

During this session, newly-introduced utilities (`grid-cols-7`, a raised
`bottom-28`) rendered wrong in the running **dev** server until it was restarted,
while the production build's CSS was always correct
(`.grid-cols-7{grid-template-columns:repeat(7,minmax(0,1fr))}`). This is a
Vite + Tailwind v4 watcher quirk when a class first appears in a brand-new file.

**Recommendation:** none in code — restart `vite` after adding files that
introduce previously-unused utility classes; trust `npm run build` output as
the source of truth for CSS.

---

## Non-issues worth recording

- **B1 "climbing timer missing"** was investigated and found already correct —
  `SessionHeader` + `useSessionTimer` are wired unconditionally for every
  climbing subtype. The real gap was the **rest** timer between workout sets,
  now fixed.
- **B3 "route edit"** was already implemented via the `editing` prop; the only
  actual defect was route `notes` never being persisted, now fixed.
- Grade PRs are correctly keyed by `climbingStyle` so V-grades and Ewbanks
  numbers are never compared.
- All Dexie access goes through `src/db/helpers.ts`; `useLiveQuery` wraps
  helpers, never `db` — the intended boundary holds across all new screens.

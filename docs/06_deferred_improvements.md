# Deferred Improvements

Longevity/extensibility work identified in the architecture review that was
deferred from the first implementation pass (too large or too risky to land
safely in one go). Each entry: **what**, **why it matters**, **the concrete
change**, and **risk**. Ordered roughly by value-per-risk.

Status legend: ⬜ not started · 🟡 in progress · ✅ done · 📌 documented-only (not
warranted yet).

---

## T3 — Extract Dexie migration transforms to pure functions  ✅

**What.** The v6/v7/v8 upgrade callbacks in `src/db/db.ts` are inline closures,
and the v8 "legacy template `type` → `categories`" logic is duplicated by
`withCategories` in `src/db/helpers.ts` (the import path).

**Why.** Migrations are the highest-consequence code (a bad one silently
corrupts records) and are currently untestable. Duplication risks the migration
and import diverging.

**Change.** Extract the per-record transforms to pure functions in
`src/lib/migrations.ts` — e.g. `legacyTemplateToCategories(t, exCat)`,
`categoryForTracking(trackingType)`, `homeVenueToBoard(venue)` — reused by both
the Dexie `.upgrade()` callbacks and the import normalisers. Unit-test them.

**Risk.** Low — pure extraction; the migration callbacks call the same function.

---

## CA2 (remainder) — finish splitting SettingsScreen  ✅

**What.** SettingsScreen is still ~1100 lines after the DataToolsSection
extraction. Remaining self-contained blocks: the gym manager, the board manager,
and the session-prefs group (toggles + pre-count + weight increment).

**Why.** Maintainability; the file mixes ~8 unrelated concerns.

**Change.** Extract `settings/GymManager.tsx`, `settings/BoardManager.tsx`,
`settings/SessionPrefsSection.tsx`, each owning its own state/handlers. The
existing `GymEditSheet`/`TagManager` already live outside.

**Risk.** Low-medium — mechanical cut/paste with prop threading; verify each
section still functions.

---

## CA1 (full) — extract `useTimedSetEngine`  ✅  (done on a branch, merged)

**What.** StrengthSessionScreen and ClimbingSessionScreen still duplicate the
timed-set engine: `work`/`hangWork` seeding, `handleLog`/`logHang`,
`startTimedSet`/`startHang`/`startAbrahang`, `autoAdvanceRef`, the
rest-completion effect, and the F48 persist/resume. The pure transforms
(`workQueue.ts`), F48 persistence (`activePhase.ts`) and PR rules (`pr.ts`) are
already extracted — this is the remaining stateful core.

**Why.** Every session fix so far had to be applied twice. A single engine keeps
the two screens as thin views.

**Change.** A `useTimedSetEngine` hook owning the three timers, the log/start/
auto-advance/resume orchestration and `abrahangLabel`; the screens pass
`{ sessionId, paused, resumeTimer, work, hangWork, loggedSets, loggedHangs,
exById, ready, onModified }` and render with what it returns. Screen-specific
glue (mixed conversion, save-template, routes/venue) stays in the screens.

**Risk.** High — a faithful move of that much timer/resume state, verifiable only
via manual preview flows. **Do on a branch**, re-run every timer path
(precount→hold→log→rest→advance, abrahang, resume-on-reload, skip mid-count,
pause/resume) on **both** screens, merge only when green.

**Done.** `src/hooks/useTimedSetEngine.ts` (397 lines) now owns the three timers,
the log/start/auto-advance/resume orchestration and `abrahangLabel`; both screens
pass their current state and render with what it returns. ~660 lines of
duplicated engine code removed. Verified in the preview on both screens
(precount→hold→log→rest→auto-advance, Abrahang, resume-on-reload, manual
rest-skip, pause/resume, route logging) — clean. Two safe reconciliations noted
in the commit (logSet always sends distanceKm+swappedFrom and gates auto-advance
on trackingType; per-screen `ready` gate).

---

## EX1 — tracking-type registry  ✅ (safe parts done)

**What.** Adding a tracking type beyond reps/duration/distance touches
`TrackingType`, the exercise form, `ExerciseCard` input dispatch,
`resolveExerciseDefaults`, `estimateDuration`, both session screens and
`ProgressScreen`.

**Why.** Open-closed: today it's shotgun surgery across many files.

**Change (safe).** Centralise a `TRACKING_TYPES` registry `{ value, label }` and
replace the scattered `TRACKING`/`TRACKING_LABEL` maps. The **rendering**
dispatch (which input row) is intentionally left as-is — a registry that injects
input components into the core logging UI is high-risk for a type that does not
exist yet.

**Done.** `src/lib/trackingTypes.ts` exports `TRACKING_TYPES` (ordered list) and
a derived `TRACKING_LABEL` record; `ExerciseFormSheet`, `ExercisePicker` and
`ExerciseLibrary` now consume it instead of their own copies.

**Risk.** Registry-of-labels: low. Rendering registry: 📌 not warranted now.

---

## TS2 — encode tracking-type as a discriminated union  📌

**What.** `TemplateExercise`/`LoggedSet` use optional `defaultReps?` /
`defaultDuration?` / `defaultDistanceKm?` that are effectively mutually
exclusive, guarded at runtime with `!= null`.

**Why.** A discriminated union would make "reps XOR duration XOR distance" a type
invariant.

**Blocker.** The discriminant (`trackingType`) lives on the `Exercise`, not on
`TemplateExercise`/`LoggedSet`. A union would require adding `trackingType` to
those records (a data-model change + backfill migration) and restructuring every
consumer. Not warranted for the current benefit; revisit if a new tracking type
lands (pairs naturally with EX1).

---

## D2 — reduce/replace recharts  📌

**What.** `recharts` (~380 KB) dominates the lazy-loaded Progress chunk.

**Why.** Bundle size; the app is otherwise small.

**Change.** The Progress charts are a handful of simple line/bar charts —
hand-rolled responsive SVG (or a lighter lib such as `uplot`) would cut the
chunk substantially. Already lazy-loaded, so not urgent for an installed PWA.

**Risk.** Medium — a full chart rewrite; defer unless bundle size becomes a
priority.

---

## EX2 — climbing-flavour registry  📌

**What.** Adding a climbing session flavour (e.g. spray-wall/drills) means
editing `deriveSessionKind`, `badgeForSession` and the flavour branches in
ClimbingSessionScreen.

**Why.** Localise the change to one place.

**Change.** A `climbingFlavour` field + a flavour registry.

**Status.** 📌 Speculative — the feature doesn't exist. Documented so the seam is
known; implement alongside the feature, not before it.

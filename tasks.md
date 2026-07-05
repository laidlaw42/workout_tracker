# Workout Tracker — Task Backlog

_Cleaned & re-aligned to the codebase on 2026-07-05. Organised by priority; related
tasks grouped; every task checked against the actual source._

## Status legend

- ✅ **Done** — implemented in the working tree (uncommitted), pending review/commit
- 🟡 **Partial** — some of the task already exists; only the noted remainder is left
- ⬜ **Not started**

## Cross-cutting realities (read before picking up any task)

These are facts about the current codebase that several tasks below get wrong. They are
corrected per-task, but the recurring ones are:

- **kg-only, no units toggle.** Weights are stored/shown in kg throughout; a kg↔lbs toggle
  is explicitly deferred (`docs/05_reference.md` → Units). Any clause mentioning lbs
  (in A32, A37, A38, A39) assumes a feature that does not exist. Treat those as **kg-only**
  for now, or build a units toggle first as an explicit prerequisite.
- **One shared `RouteCard`.** `src/components/RouteCard.tsx` is used by both
  `ClimbingSessionScreen` and `SessionDetailScreen`. Editing it once covers "active session
  and history" automatically — there is no separate History card (A44, A45, A46, A47).
- **No `ClimbingSession` table / no `climbingMode`.** A climbing session *is* a
  `WorkoutSession` with `type: 'climbing'`; routes/hangs link via `sessionId`. The venue
  discriminator is `WorkoutSession.climbingVenue: 'gym' | 'crag' | 'home'` (F21).
- **Hangboard ≠ strength.** Hangboard protocols are `WorkoutTemplate.hangboardSets:
  HangboardSet[]` (not `TemplateExercise`) and log to `LoggedHang` / the `hangs` table (not
  `LoggedSet`). Hangboard editor is `HangboardSetsEditor.tsx`; card is `HangCard.tsx` (A37).
  There is also no separate `'hangboard'` session type — hangboard content renders inside a
  `type: 'climbing'` session (A33).
- **Dexie is at schema v5** (`src/db/db.ts`). A new **index** requires a new `this.version(6)`
  block, not an in-place edit of an old store string. A new **unindexed** field needs no
  version bump at all (A36 needs a bump; A37/A44/A45/A47/A48 do not).
- **Theme module is `src/lib/theme.ts`** (singular) exposing `THEMES` and
  `THEME_PREVIEWS[id] = [background, primary, accent]`; actual colour tokens are CSS custom
  properties in `src/themes.css`. There is no `src/lib/themes.ts` (A41).

---

## Tier 0 — Ship the in-flight batch (✅ implemented, uncommitted)

A31–A35 and F17–F19 are already built in the working tree. **Action: review and commit
them.** Keep the original text below as the record; the only outstanding items are the small
optional-polish notes.

- ✅ **A31. Edit exercise parameters during an active workout** — pencil → inline `EditPanel`
  in `ExerciseCard` (strength + climbing-workout exercises) and `HangEditPanel` in `HangCard`
  (hangboard), wired via `editExercise` / `editHang` in both session screens; edits only the
  remaining unlogged sets, no navigation. _(Pure climbing route editing uses `LogRouteSheet`,
  not the inline pencil — that's by design, outside this task.)_
- ✅ **A32. Plus/minus buttons on numeric set inputs** — shared `NumberStepper` +
  `HoldButton` (A6 accelerating hold) on reps (step 1), weight (0.5 kg), additional weight
  (0.5 kg), duration (1 s) and rest, in `ExerciseCard` (strength) and `HangCard` (hangboard);
  fields stay directly editable. _Corrected: no "1 for lbs" step — the app is kg-only._
  _Optional gap: the cardio session's Distance input is still a plain field (not in the
  enumerated set)._
- ✅ **A33. Add exercises to a logged session** — "Add exercise" button (shown while
  `SessionDetailScreen` is in **Edit mode**, at the bottom of the list) opens the multi-select
  `ExercisePicker`; each pick appends a `LoggedSet` with only `sessionId`/`exerciseId`/
  `exerciseName`/`loggedAt` (plus the required `setNumber: 1`, `skipped: false`) set, editable
  inline via `EditableSetRow`. _Corrected: covers **strength and climbing** detail views
  (`StrengthDetail` / `ClimbingDetail`); there is no separate hangboard session type.
  `EditableSetRow` currently exposes weight + reps only._
- ✅ **A34. Resume workout** — `getUnfinishedSession()` (most recent session with
  `endedAt == null`), a persistent HomeScreen banner (heading "Unfinished workout") with
  Resume + Discard, full state restore on mount (logged sets, derived exercise index/set
  number, re-attached mid-session exercises), and elapsed = `now − startedAt − pausedDuration`
  via the new `WorkoutSession.pausedDuration`. _Corrected: Discard **hard-deletes** via
  `deleteSession` (matches the in-session Cancel flow); there is no soft "discarded" status._
- ✅ **A35. Tag colours & default tag selection** — 12-colour `TAG_PALETTE` cycling by
  creation order, `TagMeta` + `tags` table (v5), `TagManager` Settings section (recolour /
  rename / delete-with-warning) and a "Default tags" subsection that pre-fills new exercise
  and template tag inputs. _(No misalignments found.)_
- ✅ **F17. Cardio hidden from the strength Progress picker** — the Strength picker now lists
  only `trackingType` `reps`/`duration` exercises that appear in `getExerciseIdsWithSets()`.
  _Corrected: the "hangboard progress chart exercise picker" doesn't exist as such — that
  chart's dropdown is a **grip-type** list built from logged hangs, already filtered by
  construction, so no extra filter applies there._
- ✅ **F18. Larger set/hang text** — active "Set N of M" / "Hang N of M" labels are
  `text-base` with the number bold; card heading is `text-lg`. _Optional gap: `ExerciseCard`'s
  completed-set history row is still `text-sm` (HangCard's is `text-base`) — F18 doesn't
  require the history rows, so this is cosmetic._
- ✅ **F19. Logging resumes a paused timer** — `resume()` is called at the top of `handleLog`,
  `startTimedSet`, `logHang`, `startHangCountdown`, and (now) the `LogRouteSheet` `onSaved`
  callback — every activity-recording action lifts a pause (safe no-op when not paused) and
  persists `pausedDuration`.

---

## Tier 1 — Correctness / data-integrity fixes

### ✅ F21. Gym bouldering missing from Progress stats

_Done (committed):_ `buildPyramid` now takes a grade mode and keys off `gymGrade` in gym
mode (its own 0–35 axis, separate from V/Ewbanks); the climbing tab gained a **Standard /
Gym grades** toggle (shown only when gym-graded routes exist), for both bouldering and roped.
Clean-tick + onsight/flash gold carry over; gym bars colour via `gradeToColor(n, {min:0,max:35})`
(global fallback — the per-gym range isn't available in the flat Progress query). Verified in
the browser: gym bouldering sends now appear under the Gym grades toggle.

Original diagnosis, for reference — the bug was in `buildPyramid`
(`src/screens/ProgressScreen.tsx`): it filtered bouldering on `vGrade` only and never read
`gymGrade`, so any route logged in gym-grade mode (`gymGrade` set, `vGrade` null) was silently
dropped. The fix covered:

- **Grade-field selection** — the bouldering pyramid / hardest-send logic must use `gymGrade`
  when `vGrade` is null. Note `gymGrade` is a separate **0–35 numeric** scale, so it needs its
  own pyramid axis — do **not** merge it into the V-grade index.
- **Gym-grades view** — there is currently **no** gym-grades sub-tab in Progress (the climbing
  tab is only `boulder` / `roped` / `hangboard`); it must be **created** for gym grades
  (bouldering included), not merely extended. _(The task's "F15 gym-grades pyramid" appears
  unbuilt in Progress.)_
- **Clean-tick filter** — `CLEAN_TICKS` / `isCleanTick` already exist (`src/lib/climbing.ts`)
  and are applied to the V-grade pyramid; carry the same filter into the new `gymGrade` path.
- **Colour scale** — `gradeToColor(n)` is currently called in Progress with no range (global
  scale). The gym name isn't available in the Progress context, so **fall back to the global
  0–35 scale** rather than erroring.
- _Corrected: drop the "query joins through `ClimbingSession`… `climbingMode: gym`" language —
  the climbing query is a flat `getAllRoutes()` (`db.routes.toArray()`) with no join, so query
  scope is not the problem._

### ✅ F20. Gym grade mode persists within a session (and per-gym default)

_Done (committed):_ the active grade system is now lifted into `ClimbingSessionScreen` state,
seeded on init from a new per-gym `localStorage` preference (`gym_grade_preference`,
`{ [gymName]: 'standard' | 'gym' }`, distinct from `gym_grade_ranges`; migrated on gym
rename/delete). `LogRouteSheet` gained an `initialGradeSystem` prop (new routes open in the
session's mode) and an `onGradeSystemChange` callback that updates the session and persists the
per-gym default. The in-sheet toggle still overrides per route; editing an existing route still
derives its mode from the route's own `gymGrade`. Browser-verified: mode survives route logs
and a full remount, the Flash tick is preserved across a toggle (no field reset), and the
preference writes/reads correctly.

- _Post-review fix:_ the per-gym default is now seeded from an effect keyed on the resolved
  `session.gym`, so it also applies when a gym is typed after the screen mounts — guarded by a
  `gradeManualRef` so it never overrides a mode the user picked by hand.

### ✅ A48. Background session persistence — heartbeat done

The other three pillars were already satisfied by A34 + `useSessionTimer` + the await-first
handlers (timer reconstructs from the DB on remount, actions write before UI, last-weight
pre-fill). The remaining heartbeat is now _done (committed):_

- Added `lastActiveAt?: number` to `WorkoutSession` (unindexed — no Dexie version bump) and a
  lightweight `updateSessionHeartbeat(id)` helper.
- `useSessionTimer` writes the heartbeat once on mount and every 10 s while a session screen is
  mounted (even while paused), so it covers all three session screens from one place.
- `getUnfinishedSession()` now orders unfinished sessions by `lastActiveAt ?? startedAt`, so a
  genuinely in-progress session wins over an orphaned record a bug may have left unfinished
  (nothing is hidden, so orphans stay discardable once they're the most-recent unfinished).
- Browser-verified: `lastActiveAt` is written on mount and advances ~10 s per tick, and the
  resume banner surfaces the recently-active session over an orphan with a later `startedAt`.

---

## Session-logging fixes (F22, F23) — added 2026-07-05

Both build on the now-complete A34 (resume / `pausedDuration`) and A48 (`lastActiveAt`
heartbeat) work. Queued after the current tier; sequence at the backlog owner's discretion.

### ✅ F22. Pre-fill set inputs from the last logged set (any session)

_Done (committed):_ the active `SetRow` now seeds its inputs as **actual editable values** from
the last logged set. `getLastSetForExercise` was relaxed to return the most recent non-skipped
set regardless of `weightKg` (so bodyweight / additional-load moves pre-fill too), and
`ExerciseCard` takes a `prefill` object (`weightKg` / `additionalWeightKg` / `actualReps`)
instead of the old placeholder-only `prefillWeight`.

- **Precedence** (keeps A31 working): weight = `plannedWeight ?? lastWeight`, additional =
  `lastAdditional`, reps = `targetReps ?? lastReps`. An inline A31 edit still wins; otherwise the
  last logged values fill in; blank when neither exists (`BW` placeholder on the weight field).
- **Every set, not just the first** — the `SetRow` re-keys on `currentSetNumber` and the prefill
  values, and the `prefill` live query re-fires when the `sets` table changes, so set 2/3
  pre-fill from set 1 of the current session automatically.
- **Browser-verified:** weight opens at the last-logged `62.5` (was placeholder-only); logging
  set 1 pre-fills set 2 at `62.5`; a Pull-up's Additional field pre-fills `10` from a prior
  "BW +10" set with weight left blank.
- **Hangboard was correctly out of scope:** hangboard hangs log via the countdown "Start hang"
  flow (no typed per-set inputs in `HangCard`; load lives in `LoggedHang.weightKg`), so there is
  no `SetRow` to pre-fill there. F22 applies to `ExerciseCard` (strength + climbing-workout
  exercises).

### ✅ F23. Resume a completed workout as an active session

_Done (committed):_ a new `reopenSession(id)` helper reactivates the **same** session record in
one transaction — reads it, rolls the gap `Date.now() − endedAt` into `pausedDuration`, sets
`lastActiveAt`, and `delete`s `endedAt` (read-modify-put so the property is truly removed).
`SessionDetailScreen` shows a **"Resume workout"** button beside "Use as workout" (only when the
session is completed; `repeatSession`'s "Use as workout" is untouched) with a confirm dialog,
then navigates to `/session/${session.type}/${id}`.

- **Browser-verified** end-to-end: a session that ran 30 min and finished 1 h ago reopened with
  `endedAt` cleared, `pausedDuration` ≈ 61 min (the gap), `lastActiveAt` set, both logged sets
  preserved as green rows, set 3 active, and the header timer showing **30:01** — i.e. real
  workout time only, not the wall-clock gap.
- Logged sets / routes / cardio / hangs are left intact; the A34 restore logic shows them as
  completed rows, and the A34 resume banner treats the reopened session like any other
  in-progress one (`endedAt` null + recent `lastActiveAt`). On strength, a fully-logged reopened
  session opens at the "All sets logged" affirmation with the mid-session **Add exercise** button
  (A29); climbing has no equivalent affirmation block but still exposes route/exercise logging.
- **Post-review hardening** (adversarial review of this batch): finished-session duration now
  subtracts `pausedDuration` everywhere it's shown (`workoutDurationSeconds` helper used by the
  summary, history detail, and session cards), so a reopened+refinished workout reads its real
  length, not the wall-clock gap. Reopening a **cardio** session now updates its existing
  `LoggedCardio` on finish (was inserting a duplicate that double-counted in Progress) and
  re-hydrates the distance/notes fields from the saved row.

---

## Tier 2 — Quick wins

### ✅ A40. "Big dog" completion message

_Done (committed):_ added `'Good session, big dog'` to `COMPLETION_PHRASES` in
`src/lib/completionMessages.ts` (no trailing period, matching the existing entries).

### ✅ A41. Confetti on session complete (+ Settings toggle)

_Done (committed):_ `canvas-confetti` installed; `SessionSummaryScreen` fires one top-centre
burst once when the session first loads, in the active theme's primary + accent colours, gated
on the new `getConfettiEnabled()` pref (skips the `confetti()` call entirely when off). Added a
"Celebration confetti" `SettingSwitch` in the Settings → Workout section beside the pre-count
control (default on; `localStorage` key `confettiEnabled`; helpers mirror the existing
boolean prefs). The default canvas is `position: fixed; pointer-events: none`, so it never
blocks the Done / View details buttons. Also respects `prefers-reduced-motion`
(`disableForReducedMotion`).

- **Colour resolution fixed during verification:** `THEME_PREVIEWS` values are `oklch()` for the
  default dark/light themes, and Chromium serialises `getComputedStyle().color` back _as oklch_,
  so the first regex-based `toHex` produced garbage blue. Replaced with a canvas-pixel approach
  (paint a 1×1 canvas, read the rendered sRGB byte) — verified `oklch(0.929 0.013 255.508)` →
  `#e2e8f0` and `oklch(0.279 0.041 260.031)` → `#1d293d`.
- **Browser-verified:** the Settings toggle shows the right label/subtitle, defaults on, and
  writes `confettiEnabled` `'1'`/`'0'`; canvas-confetti renders a non-blocking (`pointer-events:
  none`, `fixed`) canvas. Live confetti isn't visible in the automated browser because it reports
  `prefers-reduced-motion: reduce` (canvas-confetti captures that once at module load) — correct
  accessibility behaviour; it fires on a normal device.
- _Note:_ used the existing `SettingSwitch` (there is no shadcn `Switch` in the repo); theme
  colours come from `src/lib/theme.ts` `THEME_PREVIEWS[getTheme()]` (`[1]` primary, `[2]` accent).

---

## Climbing display (F25–F27, A49) — added 2026-07-06

### ✅ F25. Neutral gym grades + default range 1–10

_Done (committed):_ gym grades (`gymGrade`) are no longer hue-mapped. Removed every
`gradeToColor()` call for gym values — `RouteCard`, the `LogRouteSheet` grade/felt chips, and the
Progress pyramid bars now render gym grades neutral. `gradeToColor()` itself is unchanged (still
serves V-grade and Ewbanks). The default gym range fell from 0–35 to **1–10** for all three
styles (`DEFAULT_GYM_RANGES`), which drives both the fallback and the Settings editor's initial
values; stored `gym_grade_ranges` configs are untouched. Removed the now-dead `gymRange` prop
from `RouteCard` and its plumbing in both screens. _Browser-verified:_ gym chips render 1–10 all
neutral; gym pyramid bars neutral.

### ✅ F26. Hold colour on the gym grade pill

_Done (committed):_ when a gym route has a hold colour with a representative hex, the grade pill
on the shared `RouteCard` renders in that colour with contrasting text (so the badge looks like
the tape on the wall). No colour, or Mixed/Wood/Feature (no single hex), falls back to the F25
neutral pill. Covers active session, SessionDetailScreen, and History via the one shared card.
_Browser-verified:_ a red-hold gym grade → red pill (`#ef4444`); no-colour / Mixed → neutral.

### ✅ F27. Attempt count on every RouteCard (completes A46)

_Done (committed):_ the shared `RouteCard` now shows a compact "N attempts" / "1 attempt" pill
whenever a count applies — Onsight/Flash always read "1 attempt" (A23); other ticks show the
entered value; omitted when unknown for a non-defaulting tick. Display-only (no storage /
LogRouteSheet change). This delivers the remaining part of **A46** for attempts.
_Browser-verified:_ "3 attempts", "1 attempt" (onsight & flash), "2 attempts".

### ✅ A49. Tick indicators (symbols / emojis)

_Done (committed):_ `src/lib/tickTypes.ts` exports `TICK_SYMBOLS` (Unicode) and `TICK_EMOJIS`
maps + `tickIndicator(tick, style)`. A reactive `useTickSymbol(tick)` / `useTickDisplayStyle()`
hook (`src/hooks/useTickSymbol.ts`, `useSyncExternalStore` on a custom event) reads the
`tickDisplayStyle` pref (`localStorage`, default `'emojis'`). A "Tick indicators" segmented
control in a new Settings → **Climbing** section switches Emojis/Symbols. The indicator renders
to the left of the tick label inside the existing coloured tick pill on RouteCards and the
summary tick breakdown, and does not replace the badge colour. _Browser-verified:_ emojis by
default (👁️/⚡/✅/🔧…), and flipping the setting updates all cards **live** to symbols (◎/↯/✓/◐…)
without navigation.

---

## Tier 3 — Feature groups (ordered by priority; each internally dependency-ordered)

### Exercise categories

#### ✅ A36. Exercise categories

_Done (committed):_ `category` added to `Exercise` (Dexie v6 `exercises: '&id, name, category'`
with a backfill upgrade — distance→cardio, else strength), a segmented **Category** control at
the top of `ExerciseFormSheet`, a `categories?` filter prop on `ExercisePicker` wired per
context (strength/climbing/detail/template), import backfill via `withCategory()`, and a
`category === 'strength'` filter on the Progress strength picker. _Browser-verified._

Add a required `category: 'strength' | 'cardio' | 'climbing'` to the `Exercise` type, shown as
a segmented control at the top of the create/edit form.

- **Schema** — add a **new** `this.version(6).stores({ exercises: '&id, name, category' })`
  block and **backfill** `category` on existing exercise records (in the upgrade and/or seed);
  do not edit the v1 store string in place.
- **Seed** — set categories on first seed. _Corrected:_ the library only seeds **strength**
  exercises and three cardio rows (`ex_run`/`ex_ride`/`ex_row` — no "Other", no hangboard/
  climbing Exercise rows exist), so only those get categories.
- **ExercisePicker filter** — `ExercisePicker` has **no** context/category prop today (name-
  search only). Add a `category`/context prop and filter by it in the strength and climbing
  contexts. _Drop the "cardio template" case — cardio uses activity selection, not
  `ExercisePicker`._
- **Progress filter** — this augments/replaces the existing F17 `trackingType` + logged-set
  filter in `ProgressScreen`.

#### ✅ A42. Rehab exercise category — _depends on A36_

_Done (committed):_ `'rehab'` added to `ExerciseCategory` + the form control; 8 rehab exercises
seeded (`ex_theraband_external_rotation`, `ex_wrist_roller`, `ex_rice_bucket`,
`ex_reverse_wrist_curl`, `ex_pronation_supination`, `ex_shoulder_cars`, `ex_hip_90_90`,
`ex_dead_hang`); rehab included in the strength/climbing pickers; a **Rehab** tab added to
Progress with a per-exercise chart (metric by tracking type). _Browser-verified._

Add `'rehab'` as a fourth `category` value (extends A36's enum + segmented control). Include
rehab exercises in the ExercisePicker for strength and climbing contexts (discipline-agnostic).
Seed a small rehab set with new stable `ex_*` ids and `category: 'rehab'`: Theraband external
rotation, Wrist roller, Rice bucket, Reverse wrist curl, Pronation/supination, Shoulder CARs,
Hip 90/90, Dead hang (passive, unloaded). Add a **Rehab tab/filter** to Progress (net-new —
Progress has no category-based tabs yet) so recovery work stays out of the strength charts.
_Keep separate from A36; land as a fast follow-up._

### Bodyweight

#### ✅ A38. Bodyweight field in Settings

_Done (committed):_ new `src/lib/bodyweight.ts` (`getBodyweight`/`setBodyweight`, kg-only,
`localStorage` key `bodyweight`); a **Bodyweight** `NumberStepper` field in Settings → "You".
_Browser-verified._

Add a "Bodyweight" field near the existing Name field. _Corrected:_ the Name field lives under
a section headed **"You"** (via `src/lib/userName.ts`), not "Profile" — create a Profile
section or reuse "You". Add a `getBodyweight`/`setBodyweight` helper mirroring `userName.ts`,
storing under `localStorage` key `bodyweight`. **Implement kg-only** (drop the "respects the
units setting / converts on unit change" clause — there is no units toggle; gate that behaviour
on a future units feature). `NumberStepper` can be reused for the input.

#### ✅ A39. Bodyweight percentage on weight inputs — _depends on A38 (hard), A37 (hang part only)_

_Done (committed):_ `ExerciseCard` shows a reactive % hint beside the weight field
(`round(weight/bw*100)`) and the additional-weight field (`round((bw+addl)/bw*100)`), hidden
when no bodyweight is set. Scoped to the two existing inputs per the task; hang-weight % remains
deferred with A37's new inputs. _Browser-verified._

Show effort as a % of bodyweight beside each active-session weight input, updating reactively:
`(weight / bw) * 100` for added load; `((bw + additional) / bw) * 100` for
`supportsAdditionalWeight` exercises; for assisted (negative) hangs `((bw − assist) / bw) * 100`.
Hidden only when no bodyweight is set.

- **Scope now** to the two inputs that exist: the standard `weightKg` field and the
  `additionalWeightKg` field (A19 — real, wired in `ExerciseCard`). The label attaches in
  `ExerciseCard`, driven off `NumberStepper`'s existing string state.
- **Defer** the "max hang / Abrahang weight" percentage into A37 (those inputs don't exist yet).

### Climbing route metadata (A45 → A46 → A47)

These three all touch `LogRouteSheet`, the `ClimbingRoute` type, the shared `RouteCard`, and
the Progress climbing tab. Do them as one unit; **A46 is the smallest and can ship first**.

#### ✅ A45. Climb character (supersedes wall angle)

_Done (committed):_ `climbCharacter` (slab/vertical/overhang/roof/cave/crack) added to
`ClimbingRoute` + a 6-option Character selector in `LogRouteSheet` (replaces the old 3-way
toggle); Gym gained an optional degree input (`showDegrees = isBoard || isGym`, board −45..90 /
gym 0..90). Legacy `wallAngle` migrated via a meta-flagged `migrateWallAngles()` + a RouteCard
fallback, then cleared on save. RouteCard shows the character; Progress gained a
sends-by-character breakdown. _Browser-verified._

Add a required single-select **Character** — Slab, Vertical, Overhang, **Roof, Cave, Crack** —
stored in a new `climbCharacter?: 'slab'|'vertical'|'overhang'|'roof'|'cave'|'crack'` on
`ClimbingRoute` (a superset of the existing 3-value `WallAngle`/`WALL_ANGLES`). This replaces
the Slab/Vertical/Overhang toggle for Gym & Crag and augments Home.

- **Home** keeps its existing degree input alongside the selector. **Gym** gains a **new**
  optional degree input (there is none today; the current degree input is Home/board-only,
  clamped **−45..90**, so the task's "0–90" is a different clamp — decide which). **Crag** =
  selector only. The optional degree goes in the existing `wallAngleDegrees` (currently written
  for board sessions only).
- **Migrate** existing `wallAngle` → `climbCharacter`, then clear `wallAngle` (plain unindexed
  field — no version bump).
- **Display** on the shared `RouteCard` (which currently renders neither the `wallAngle` enum
  nor any character). Add a **sends-by-character breakdown** in Progress (net-new).

#### ✅ A46. Attempt count on route cards — done via F27

The attempts display (singular/plural, including the `1` for Onsight/Flash) shipped as **F27**
above. The remaining "alongside … character" wording still depends on A45's `climbCharacter`
being added to the card.

#### ✅ A47. Climb style tags (multi-select) — _depends on A45_

_Done (committed):_ `climbStyles?: string[]` added to `ClimbingRoute`; a 17-tag `CLIMB_STYLE_TAGS`
constant (Crimpy…Thuggish) drives an optional multi-select **Style** field in `LogRouteSheet`
after Character; pills render (wrapping) on the shared `RouteCard`; Progress gained a
style-breakdown of clean sends. _Browser-verified._

Add an optional multi-select **Style** to `LogRouteSheet` (after the Character field), stored
as `climbStyles?: string[]` on `ClimbingRoute` (unindexed — no version bump). Introduce the
descriptor constant (Crimpy, Juggy, Pumpy, Slopey, Pinchy, Dynamic, Static, Technical,
Powerful, Endurance, Compression, Balancy, Mantle, Stemmy, Roofed, Fingery, Thuggish — none
exists in code yet). Render as pills on the shared `RouteCard` (wrapping). Add a **style
breakdown of clean sends** in Progress (net-new; use existing `CLEAN_TICKS`). `addRoute`/
`updateRoute` already spread all fields, so persistence just needs the field added in
`LogRouteSheet.save()`.

### ✅ A37. Hang types for hangboard exercises

_Done (committed):_ `HangType` (`sub_max` | `max_hang` | `abrahang`) added — required on
`HangboardSet`, optional on `LoggedHang` (+ `abrahangReps`, `intraRestSeconds`). Per-row hang-type
`SegmentedControl` and abrahang reps/intra-rest fields in `HangboardSetsEditor`; `startAbrahang()`
runs the automated precount → work/intra-rest ×N → inter-set rest sequence in
`ClimbingSessionScreen`, storing one `LoggedHang` with `abrahangReps`. Repeaters→sub_max,
Max hangs→max_hang, plus a new Abrahangs seed template; `BUILTIN_SET_VERSION` bumped 4→5.
_Browser-verified._

Add a hang type — `sub_max` | `max_hang` | `abrahang` — required on **`HangboardSet`**
(template-level) and optional on **`LoggedHang`** (session-level), overridable per set.
_Corrected: hangboard uses `HangboardSet`/`LoggedHang`, **not** `TemplateExercise`/`LoggedSet`;
editor is `HangboardSetsEditor.tsx`, card is `HangCard.tsx`._

- **Sub-max** — edge, grip, duration, rest. No extra fields.
- **Max hang** — edge, grip, duration (7–10 s), rest, plus **added/assisted load stored in the
  existing `weightKg`** field (`+ added / − assisted`), which already supports negatives (the
  `HangCard` weight stepper allows < 0; PR logic guards `weightKg > 0`). _Corrected: do **not**
  use `additionalWeightKg`/`LoggedSet`/A19 — that's the strength path._
- **Abrahang** — reps (default 6), work (7 s), intra-rest (3 s), edge, grip, added weight; runs
  as an automated sequence: precount (A30 infra exists — `precount.start` already wraps hang
  countdowns) → alternate work / short intra-rest countdowns for N reps → full inter-set rest.
  The intra-rest uses the A7 beeps (`src/lib/sound.ts`) but **no** full RestTimer UI. _Note: no
  intra-set rest countdown exists yet (`SetCountdown`/`useCountdownTimer` are single-shot), so
  that loop is new._ Store completed Abrahangs as one `LoggedHang` with a new
  `abrahangReps: number`.
- **Seed** — _Corrected: the two example templates already exist_
  (`tpl_hangboard_repeaters`, `tpl_hangboard_maxhangs`, using the 180 s / 300 s constants).
  Tag them `sub_max` / `max_hang` and bump `BUILTIN_SET_VERSION` to re-seed; optionally add a
  third template demonstrating `abrahang`.
- New fields are unindexed → no Dexie version bump. Drop the "kg/lbs" unit (kg-only).

### ✅ A43. User-defined gym route colours in Settings

_Done (committed):_ 8 new built-ins added (Black, White, Grey, Teal, Lime, Cyan, Maroon, Navy —
20 total); a Settings **Route colours** section (built-ins non-deletable, custom add form with a
native `<input type="color">` + name, delete, case-insensitive uniqueness with inline error);
customs persist to `localStorage` `custom_route_colours` as `[{name,hex}]` (populating both
`swatch` and `solid`); the `LogRouteSheet` grid merges built-ins + customs under a "Custom"
divider; `findRouteColour` resolves customs. _Browser-verified._

Extend the fixed gym-tape palette with user-defined colours.

- _Corrected self-reference:_ "the built-in list from **A26**" (not "from A43"). The built-in
  list is `ROUTE_COLOURS` in `src/lib/routeColours.ts`.
- _Corrected list:_ the code currently has **12** built-ins — Red, Yellow, Green, Orange, Pink,
  Purple, Brown, Blue, Indigo, Mixed, Wood, Feature. **Black, White, Grey, Teal, Lime, Cyan,
  Maroon, Navy are NOT present** — so this task also **adds those 8 as new built-ins** (state
  that explicitly rather than treating them as existing).
- **Settings "Route Colours" section** — full list with built-ins non-deletable, custom entries
  deletable; "Add colour" form (name + native `<input type="color">`); persist to
  `localStorage` `custom_route_colours` as `[{ name, hex }]`. Names unique (case-insensitive)
  vs built-ins and customs, else inline error.
- **Dropdown** (`LogRouteSheet`, Gym only) — merge built-ins + customs with a "Custom" divider.
  _Note: `RouteColour` renders via a `swatch` (CSS background) and a `solid` (hex for the
  RouteCard pill) — a custom hex must populate **both**. Mixed/Wood/Feature keep their
  gradient/neutral placeholders._

### ✅ A44. Route height in metres

_Done (committed):_ optional `heightMetres?: number` added to `ClimbingRoute` (unindexed); a
"Height (m)" `HoldButton` ± stepper (0.5 m steps, decimal, optional) in `LogRouteSheet` after
the route name; RouteCard shows "12.5m"; SessionSummary gains a "Metres" tile and the Progress
climbing tab a "Metres climbed per session" line chart. _Browser-verified._

Add optional `heightMetres?: number` to `ClimbingRoute` (**type only** — unindexed display
field, no Dexie index/version bump). Add a "Height (m)" input to `LogRouteSheet` for all venues
(after the colour selector for Gym; after route name for Crag/Home) using the A6 `HoldButton`
+/− pattern at **step 0.5 m**, always optional. Show on the shared `RouteCard` as "12.5m".
Additive scope: total metres/session as a `SessionSummaryScreen` stat and a Progress climbing
line chart. (Metres are unaffected by the missing units toggle.)

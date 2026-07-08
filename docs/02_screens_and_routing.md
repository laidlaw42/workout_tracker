# Screens & Routing

## Route structure

```
/                         → Home (redirect → /home)
/home                     → HomeScreen
/planner                  → PlannerScreen (calendar: week / month / list)
/library                  → LibraryScreen (workout template browser)
/library/:id              → TemplateDetailScreen
/library/:id/edit         → TemplateEditScreen
/session/strength/:id     → StrengthSessionScreen  (id = session uuid)
/session/cardio/:id       → CardioSessionScreen
/session/climbing/:id     → ClimbingSessionScreen
/session/:id/summary      → SessionSummaryScreen
/history                  → HistoryScreen
/history/:id              → SessionDetailScreen
/progress                 → ProgressScreen
/settings                 → SettingsScreen
```

All routes are client-side (React Router). GitHub Pages needs a `404.html` redirect trick — include this in the build.

---

## Screen inventory

### HomeScreen `/home`

**Purpose:** Launch pad and daily overview.

**Shows:**
- Greeting with today's date
- "Quick start" row: 3 buttons — Strength, Cardio, Climbing
- "Recent workouts" list: last 5 sessions (name, date, duration, discipline badge)
- Streak counter (consecutive days with a session)

**Actions:**
- Tap Strength/Cardio → LibraryScreen filtered by type
- Tap Climbing → create a `WorkoutSession` (`type: 'climbing'`) via `createSession`, then navigate to `/session/climbing/:newId` (no template involved)
- Tap recent session → SessionDetailScreen

---

### PlannerScreen `/planner`

**Purpose:** Schedule workouts on a calendar and see planned vs completed.

**Views** (pill toggle at top):
- **Week** — 7-column grid; each day lists compact planned cards + a coloured dot per completed session. Swipe or ‹ › to change week.
- **Month** — calendar grid; each date shows discipline dots (solid = completed session, faded = still-planned). Swipe or ‹ › to change month.
- **List** — chronological, grouped by week (4 weeks forward + history backward); planned = outlined cards, logged sessions = filled cards.

**Day-detail sheet** (tap any day): planned entries (name, discipline badge, optional time, edit/delete) + completed sessions (tap → SessionDetailScreen) + "Add to this day" → template picker → `addPlannedWorkout`.

Plans live in the `plannedWorkouts` table; finishing a session best-effort links it to a same-day, same-template plan.

---

### LibraryScreen `/library`

**Purpose:** Browse and manage workout templates (strength, cardio, and climbing).

**Shows:**
- Filter tabs: All / Strength / Cardio / Climbing (+ tag chips)
- Split into **Workouts** and **Exercises** tabs; exercises have their own CRUD manager
- Template cards: name, type badge, exercise count or activity, last used date
- Climbing quick-starts (Gym / Crag plain sessions) on the Climbing filter
- "New" button (header): opens a dialog for name + kind (strength / cardio / hangboard / climbing-workout), creates an empty template, and opens its editor

**Actions:**
- Tap card → TemplateDetailScreen
- New → create-workout dialog → TemplateEditScreen
- Long-press card → delete confirmation

---

### TemplateDetailScreen `/library/:id`

**Purpose:** Preview a template before starting it, or launch it.

**Shows:**
- Template name + type badge
- Ordered list of exercises with default sets × reps and rest time
- "Start workout" primary button
- "Edit template" secondary button

**Actions:**
- Start workout → creates WorkoutSession record, navigates to appropriate session screen
- Edit template → TemplateEditScreen

---

### TemplateEditScreen `/library/:id/edit`

**Purpose:** Create or modify a template. Strength templates edit the exercise list; cardio templates edit activity, targets, and intervals.

**Shows (strength):**
- Editable template name field
- Drag-reorderable exercise list (each row: name, sets, reps, rest — all editable inline)
- "Add exercise" button → opens exercise picker sheet
- Delete button on each row
- "Save" (header) and back = Cancel (with discard confirm)

**Shows (cardio):**
- Editable name, activity (Run / Ride / Row / Other)
- Target duration (min) and/or distance (km)
- Intervals builder — rounds of steps (label + min:sec), add/remove step and round

**Actions:**
- Save → upsertTemplate, navigate back to TemplateDetailScreen
- Add exercise → bottom sheet with searchable exercise library + "Create new" option
- Reorder → drag handle (react-beautiful-dnd or @dnd-kit/core)

---

### StrengthSessionScreen `/session/strength/:id`

**Purpose:** Active strength workout. Primary interaction surface.

**Layout (top to bottom):**
1. Header bar: template name, elapsed timer (HH:MM:SS), "Finish" button
2. Exercise list — scrollable, one card per exercise:
   - Exercise name + set counter (e.g. "Set 2 of 4")
   - Previous best weight pre-filled (from `getLastSetForExercise`)
   - Weight input (kg, numeric keyboard) + reps input
   - "Log set" button
   - Rest timer: auto-starts after logging a set, counts down, vibrates at 0
3. Floating "Edit workout" FAB (`ModifyFab`, shared across disciplines) → bottom sheet

**Mid-session modify sheet:**
- Add exercise to the workout (multi-select picker)
- Swap current exercise: searchable exercise picker
- Skip remaining sets for this exercise
- **Remove** current exercise ("Logged sets will be kept")
- Reorder remaining exercises via drag (@dnd-kit/sortable)

**Actions:**
- Log set → addSet(), check PR, auto-scroll to next set
- Finish → endSession(), navigate to /session/:id/summary

---

### CardioSessionScreen `/session/cardio/:id`

**Purpose:** Active cardio session with live timer and interval support.

**Layout:**
1. Header: activity name, "Finish" button
2. Large elapsed time display (MM:SS)
3. If intervals configured: current interval name + countdown + interval progress dots
4. Distance input (optional, manual entry — no GPS in v1)
5. Pace display (auto-calculated when distance entered)
6. Notes field

**Actions:**
- Finish → addCardio(), endSession(), navigate to summary

---

### ClimbingSessionScreen `/session/climbing/:id`

**Purpose:** Log a climbing session (`type: 'climbing'`). Two flavours from one screen:
- **Plain** (gym/crag/board quick-start): route logging only.
- **Climbing-workout** template (or a repeat session): a strength-style Exercises section (with the `RestTimer` between sets) **plus** routes. Hangs are ordinary duration exercises in that section (F51 — grip-as-exercise), rendered by `ExerciseCard`; there is no separate hang card.

Hangboard-only training sessions are typed `'mixed'` and log on the training screen (A73), not here — the shared `useTimedSetEngine` hook drives the set timers (incl. the Abrahang intra-rest runner) on both.

The `WorkoutSession` (`type: 'climbing'`) already exists before this screen loads. Routes link to it via `sessionId`; exercises/hangs log as `LoggedSet`s. There is no separate climbing-session record. Optional `gym`/`crag`/`board` are edited on the session itself. The elapsed timer runs for both flavours.

**Layout:**
1. Header: "Climbing session", elapsed timer, "Finish" button
2. Optional gym/crag field (saved onto the session)
3. "Log a route" button → opens LogRouteSheet
4. Scrollable list of routes logged this session (most recent first):
   - Grade + style badge + tick type badge
   - Route name/colour if set
   - Tap to edit

**LogRouteSheet (bottom sheet):**
- Step 1: Style selector — Bouldering / Top rope / Lead (segmented control)
- Step 2: grade picker — V-grade chips (VB, V0–V17) for bouldering, or the full **Ewbanks 1–39** colour-banded chip row (green/yellow/orange/red/magenta) for roped. **Wall angle** (Slab/Vertical/Overhang, optional) is offered for **every** style.
- Step 3: Tick type picker — filtered to valid ticks for chosen style
- Optional: route name / colour, attempts count, notes
- "Save route" button; editing an existing route (tap a RouteCard) pre-fills and saves via `updateRoute`

**Tick type options by style:**
- Bouldering: Onsight, Flash, Send, Working, Repeat, Dab
- Top rope: Onsight, Flash, Clean, Hang dog, Attempt
- Lead: Onsight, Flash, Redpoint, Pink point, Hang dog, Attempt, Retreat

**Actions:**
- Save route → addRoute()
- Finish → endSession(), navigate to summary

---

### SessionSummaryScreen `/session/:id/summary`

**Purpose:** Post-session recap. Shared by all three disciplines.

**Strength summary shows:**
- Total duration
- Exercises completed
- Total sets logged
- Total volume (sum of weight × reps across all sets, kg)
- Any PRs achieved (highlighted)
- "Save edits to template?" prompt if session was modified (yes → upsertTemplate)

**Cardio summary shows:**
- Duration, distance, avg pace
- Interval splits if applicable

**Climbing summary shows:**
- Routes logged count
- Hardest clean send, reported **separately for bouldering (V) and roped (Ewbanks)** since the two grade systems aren't comparable
- Tick type breakdown (e.g. 2 flashes, 3 sends, 1 working)
- Duration

**Actions:**
- Done → navigate to /home
- View full detail → /history/:id

---

### HistoryScreen `/history`

**Purpose:** Browse past sessions.

**Shows:**
- Filter: All / Strength / Cardio / Climbing
- Session list ordered by date descending
- Each row: discipline icon, name, date, duration, key stat (volume / distance / hardest send)

---

### SessionDetailScreen `/history/:id`

**Purpose:** View — and edit or delete — a completed session.

**Strength:** Full set log with weight × reps per exercise.
**Cardio:** Duration, distance, pace, interval splits.
**Climbing:** Full route list with grade, tick, notes.

**Edit mode** (header Edit toggle):
- Strength: edit each set's weight/reps, delete sets, add sets, add an exercise
- Cardio: edit distance and duration (pace recomputed)
- Climbing: tap a route to edit, delete routes, add routes
- Notes editable for all types
- Header trash icon deletes the whole session (confirm) → cascades to its sets/cardio/routes/PRs

---

### ProgressScreen `/progress`

**Purpose:** Charts and PRs.

**Tabs:**
1. **Strength** — exercise picker → line chart of best weight over time + PR history (queried by `exerciseId` via `getSetsForExercise`, not by name)
2. **Cardio** — activity picker → pace over time, distance over time
3. **Hangboard** — grip picker → best added-weight / hang-time over time + PR history
4. **Climbing** — grade pyramid (bar chart, sends per grade, V and Ewbanks separately) + character/style breakdowns + metres-climbed trend
5. **Rehab** — exercise picker → recovery-work trend (longest hold / top weight / total reps)

**Charts:** hand-rolled responsive SVG in `src/components/charts/` (`LineChart`, `HBarChart`) — themed via CSS variables, no chart-library dependency (D2).

---

### SettingsScreen `/settings`

**Shows:**
- **You** — name field (persisted to `localStorage['user_name']`, used in the Home greeting)
- **Theme** — 2-column grid of 28 themes (dark left / light right), applied via `applyTheme` (`data-theme` on `<html>` + `.dark` toggle, stored in `localStorage['theme']`)
- **Data:**
  - Export data → `exportAllData()`, downloads JSON
  - Import data → file picker → `importAllData()` (**replaces** all data, confirmed)
  - Import and merge → file picker → `mergeData()` (adds only new ids; toast shows counts)
  - Clear all data → **two-step** confirmation → `clearAllData()` → toast + navigate home
- **About** section with version number (weights are kg-only in v1)

---

## Shared components

| Component | Purpose |
|---|---|
| `BottomNav` | 5-tab nav bar fixed to bottom: Home, Planner, Library, History, Progress |
| `SessionHeader` | Sticky header with title, elapsed timer, pause/resume, cancel, Finish |
| `ModifyFab` | Shared "Edit workout" FAB — same bottom-right spot on strength, cardio, climbing |
| `RestTimer` | Countdown with haptic feedback at 0, auto-dismiss (strength + climbing-workout) |
| `CardioEditSheet` | Mid-session cardio editor: activity + intervals |
| `TemplatePickerSheet` / `DayDetailSheet` | Planner: pick a template to schedule; per-day detail |
| `GradePickerSheet` | Reusable V-grade or Ewbanks picker |
| `TickTypePicker` | Filtered tick options for a given climbing style |
| `ExercisePicker` | Searchable list from exercise library |
| `PRBadge` | Animated badge shown when a PR is detected |
| `DisciplineBadge` | Coloured pill: Strength / Cardio / Climbing / Bouldering / Lead etc. |
| `EmptyState` | Consistent empty state with icon + message + optional CTA |

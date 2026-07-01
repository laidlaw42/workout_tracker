# Screens & Routing

## Route structure

```
/                         → Home (redirect → /home)
/home                     → HomeScreen
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

### LibraryScreen `/library`

**Purpose:** Browse and manage workout templates (strength + cardio only).

**Shows:**
- Filter tabs: All / Strength / Cardio
- Template cards: name, type badge, exercise count or activity, last used date
- FAB: not needed (library is pre-built; editing happens on detail screen)

**Actions:**
- Tap card → TemplateDetailScreen
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

**Purpose:** Modify a template's exercise list, order, sets, reps, and rest times.

**Shows:**
- Editable template name field
- Drag-reorderable exercise list (each row: name, sets, reps, rest — all editable inline)
- "Add exercise" button → opens exercise picker sheet
- "Remove" swipe action on each row
- "Save" and "Cancel" in header

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
3. Floating "Modify" button → bottom sheet for swap / skip / add set

**Mid-session modify sheet:**
- Swap exercise: searchable exercise picker
- Skip remaining sets for this exercise
- Add an extra set to current exercise
- Reorder remaining exercises

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

**Purpose:** Log individual route attempts throughout a climbing session.

The `WorkoutSession` (`type: 'climbing'`) already exists before this screen loads — it is created when the user taps *Climbing* on Home (see Phase 3). Routes link to it directly via `sessionId`; there is no separate climbing-session record. Optional `gym`/`crag` are edited on the session itself.

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
- Step 2 (bouldering): V-grade picker (VB, V0–V17) + wall angle
- Step 2 (roped): Ewbanks grade number input + Top rope / Lead toggle
- Step 3: Tick type picker — filtered to valid ticks for chosen style
- Optional: route name / colour, attempts count, notes
- "Save route" button

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

**Purpose:** Full read-only view of a completed session.

**Strength:** Full set log with weight × reps per exercise.
**Cardio:** Duration, distance, pace, interval splits.
**Climbing:** Full route list with grade, tick, notes.

---

### ProgressScreen `/progress`

**Purpose:** Charts and PRs.

**Tabs:**
1. **Strength** — exercise picker → line chart of best weight over time + PR history (queried by `exerciseId` via `getSetsForExercise`, not by name)
2. **Cardio** — activity picker → pace over time, distance over time
3. **Climbing** — grade pyramid (bar chart, sends per grade, V and Ewbanks separately), hardest grade per month

**Chart library:** Recharts (already in shadcn ecosystem, works well on mobile).

---

### SettingsScreen `/settings`

**Shows:**
- Export data → triggers exportAllData(), downloads JSON file
- Import data → file picker, triggers importAllData()
- "About" section with version number (weights are kg-only in v1)

---

## Shared components

| Component | Purpose |
|---|---|
| `BottomNav` | 4-tab nav bar fixed to bottom: Home, Library, History, Progress |
| `SessionHeader` | Sticky header with title, elapsed timer, Finish button |
| `RestTimer` | Countdown with haptic feedback at 0, auto-dismiss |
| `GradePickerSheet` | Reusable V-grade or Ewbanks picker |
| `TickTypePicker` | Filtered tick options for a given climbing style |
| `ExercisePicker` | Searchable list from exercise library |
| `PRBadge` | Animated badge shown when a PR is detected |
| `DisciplineBadge` | Coloured pill: Strength / Cardio / Climbing / Bouldering / Lead etc. |
| `EmptyState` | Consistent empty state with icon + message + optional CTA |

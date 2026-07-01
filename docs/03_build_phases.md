# Build Phases

Each phase ends with a working, committable, installable app state. Run `npm run dev` and verify on iPhone via local network before closing each phase.

---

## Phase 1 — Scaffold & PWA shell

**Goal:** Installable blank app on iPhone with correct manifest, icon, and offline service worker.

### Claude instructions

```
Set up a new Vite + React + TypeScript project at the current working directory.

Install these packages:
- tailwindcss @tailwindcss/vite
- shadcn/ui (init with default style, slate base colour, CSS variables)
- react-router-dom
- dexie dexie-react-hooks
- lucide-react
- vite-plugin-pwa
- @types/node (dev)

Configure:
1. tailwind.config.ts — enable dark mode via class strategy, add src/**/*.{ts,tsx} to content paths
2. vite.config.ts — add @tailwindcss/vite plugin and vite-plugin-pwa with:
   - registerType: 'autoUpdate'
   - manifest: name 'Workout Tracker', short_name 'Workouts', theme_color '#0f172a',
     background_color '#0f172a', display 'standalone', orientation 'portrait',
     icons for 192x192 and 512x512 (maskable)
   - workbox: globPatterns ['**/*.{js,css,html,ico,png,svg}']
3. src/main.tsx — wrap app in <BrowserRouter>, set up dark mode class on <html>
4. src/App.tsx — placeholder routes for /home, /library, /history, /progress, /settings
   each rendering a minimal screen component that just shows the route name
5. src/components/BottomNav.tsx — 4-tab bottom navigation:
   tabs: Home (ti-home), Library (ti-list), History (ti-clock), Progress (ti-chart-bar)
   active tab highlighted, links to correct routes
   safe area padding bottom for iPhone notch (pb-safe)
6. public/icons/ — generate placeholder 192x192 and 512x512 PNG icons (solid #3b82f6
   background with white 'W' text centred) using a small Node script run at build time
7. .github/workflows/deploy.yml — GitHub Actions workflow:
   triggers on push to main
   runs: npm ci, npm run build
   deploys dist/ to gh-pages branch using peaceiris/actions-gh-pages
8. Add a 404.html to public/ that redirects to index.html for client-side routing on
   GitHub Pages (standard SPA redirect script)

Deliverable: `npm run build` succeeds, `npm run dev` shows bottom nav with placeholder
screens, app is installable as PWA when served over HTTPS.
```

---

## Phase 2 — Database layer

**Goal:** Dexie schema, all typed helpers, and seed data working in browser.

### Claude instructions

```
Implement the full database layer as specified in docs/01_data_model.md.

1. Create src/db/db.ts — WorkoutDB class extending Dexie with all 8 tables and version 1
   schema as documented. Export singleton `db` instance.

2. Create src/db/helpers.ts — implement every function listed in the helpers section of
   docs/01_data_model.md. Use these patterns:
   - Always use crypto.randomUUID() for id generation
   - Always use Date.now() for timestamps
   - getLastSetForExercise: query sets table ordered by loggedAt desc, limit 1
   - checkAndSavePR: query existing PRs for exerciseName + prType, compare value,
     save and return true only if new value beats existing best
   - exportAllData: read all tables via Promise.all, return JSON.stringify of the object
   - importAllData: parse JSON, clear all tables, bulk-insert each table in order

3. Create src/db/seed.ts — implement seedIfNeeded():
   - Check localStorage.getItem('db_seeded') — if truthy, return early
   - Insert all exercises from the list in docs/01_data_model.md
   - Insert all 5 templates from docs/01_data_model.md with correct TemplateExercise
     arrays referencing the seeded exercise IDs
   - Set localStorage.setItem('db_seeded', '1')

4. Call seedIfNeeded() in src/main.tsx before rendering the app (await it inside an
   async IIFE, show a brief loading state while it runs).

5. Create src/hooks/useDb.ts — thin hook that re-exports useLiveQuery from
   dexie-react-hooks for use across the app.

Deliverable: open browser console, run `import('./src/db/db').then(m => m.db.templates.toArray()).then(console.log)` — should log 5 seeded templates.
```

---

## Phase 3 — Home screen & navigation

**Goal:** Real home screen with recent sessions, streak, and quick-start buttons.

### Claude instructions

```
Implement HomeScreen at src/screens/HomeScreen.tsx and wire up real navigation.

HomeScreen layout (mobile-first, dark-mode-ready Tailwind):
- Top section: greeting ("Good morning" / "Good afternoon" / "Good evening" based on
  hour), today's date formatted as "Wednesday, 1 July"
- Streak card: query sessions table, compute consecutive days with at least one session
  ending today or yesterday, display count with a flame icon
- Quick start row: three equal-width buttons side by side
    Strength (dumbbell icon, teal) → navigate to /library?type=strength
    Cardio (activity icon, coral) → navigate to /library?type=cardio
    Climbing (mountain icon, green) → navigate to /session/climbing/new
- Recent sessions section: useLiveQuery to fetch last 5 sessions ordered by startedAt
  desc, render as a list of SessionCard components
  SessionCard shows: discipline badge, session name, date (relative: "today", "yesterday",
  "3 days ago"), duration, primary stat
  Tap → /history/:id

SessionCard component: src/components/SessionCard.tsx
DisciplineBadge component: src/components/DisciplineBadge.tsx
  — renders a coloured pill based on discipline type:
    strength: teal bg, 'Strength'
    cardio: coral bg, 'Cardio'
    climbing: green bg, 'Climbing'

EmptyState component: src/components/EmptyState.tsx
  — icon prop, title prop, subtitle prop, optional action button

Show EmptyState in recent sessions when no sessions exist yet.

Deliverable: HomeScreen renders with seeded data visible, navigation to Library works.
```

---

## Phase 4 — Workout library & template detail

**Goal:** Browse templates, view detail, and navigate to edit.

### Claude instructions

```
Implement LibraryScreen and TemplateDetailScreen.

LibraryScreen (src/screens/LibraryScreen.tsx):
- Read ?type= query param from URL to set initial filter tab
- Filter tabs: All / Strength / Cardio (pill-style segmented control)
- useLiveQuery on templates table filtered by selected type
- Render TemplateCard for each result:
    name, type badge, exercise count (e.g. "5 exercises"), last used date or "Never used"
    tap → /library/:id
- EmptyState if no templates match filter

TemplateDetailScreen (src/screens/TemplateDetailScreen.tsx):
- Load template by :id param using getTemplate()
- Show: name, type badge, tags
- Ordered exercise list: each item shows exercise name, sets × reps, rest time
  (e.g. "4 × 8 — 90s rest")
- For cardio templates: show activity, target duration/distance, interval structure if set
- Two action buttons fixed to bottom:
    Primary: "Start workout" (full width, prominent)
    Secondary: "Edit template" (outline)
- Start workout action:
    call createSession({ templateId: id, templateName: template.name, type: template.type,
      startedAt: Date.now(), modifiedFromTemplate: false })
    navigate to /session/strength/:newSessionId or /session/cardio/:newSessionId

Deliverable: browse templates, tap through to detail, tap Start creates a session record
in DB and navigates to session screen (placeholder screen is fine at this stage).
```

---

## Phase 5 — Template editor

**Goal:** Edit exercise list, sets, reps, rest times. Add exercises from library.

### Claude instructions

```
Implement TemplateEditScreen at src/screens/TemplateEditScreen.tsx.

Use @dnd-kit/core and @dnd-kit/sortable for drag-to-reorder (install both).

Layout:
- Editable template name (text input at top)
- Sortable exercise list using DndContext + SortableContext:
    Each row has a drag handle (grip icon), exercise name, inline inputs for sets / reps
    / rest seconds, and a delete button (trash icon)
    Inline inputs use shadcn Input, small size, number keyboard type
- "Add exercise" button below list → opens ExercisePicker sheet

ExercisePicker sheet (src/components/ExercisePicker.tsx):
- shadcn Sheet component, slides up from bottom
- Search input at top (filters exercise list by name)
- Scrollable list of exercises from getAllExercises()
- "Create new exercise" row at bottom → inline form: name, muscle groups (comma-separated),
  tracking type (reps / duration / distance)
- Tap any exercise → adds it to the template exercise list with defaults:
  sets: 3, reps: 10, rest: 90s

Header: "Edit [name]" title, Cancel and Save buttons
Save: call upsertTemplate with updated data, navigate back to /library/:id
Cancel: navigate back without saving (confirm dialog if changes were made)

Deliverable: full round-trip edit — open template, reorder exercises, change sets/reps,
save, verify changes persist via TemplateDetailScreen.
```

---

## Phase 6 — Strength session screen

**Goal:** Core workout logging experience. The most-used screen in the app.

### Claude instructions

```
Implement StrengthSessionScreen at src/screens/StrengthSessionScreen.tsx.

This is the most important screen. Take care with UX details.

State:
- Load session by :id, load template exercises to build the set queue
- Track: current exercise index, current set number, rest timer state
- Keep a local list of exercises (allows mid-session modification)

Layout:
1. SessionHeader (sticky): template name, elapsed timer (useElapsedTimer hook), Finish btn
2. Scrollable exercise list — one ExerciseCard per exercise:

ExerciseCard (src/components/ExerciseCard.tsx):
- Exercise name (bold)
- For each set: a SetRow:
    Set number | Weight input (kg) | × | Reps input | Log button
    Pre-fill weight from getLastSetForExercise (show as placeholder, greyed)
    After logging: row turns green, shows checkmark, rest timer starts
- Sets are revealed one at a time — only the current set is interactive, completed sets
  shown as read-only green rows above, future sets shown as greyed placeholders below

RestTimer component (src/components/RestTimer.tsx):
- Appears as a bottom sheet / toast after each set is logged
- Counts down from defaultRestSeconds
- Shows current count in large text, progress ring around it
- "Skip rest" button dismisses early
- At 0: call window.navigator.vibrate([200, 100, 200]) for haptic feedback (where supported)
- Auto-dismisses after 2s at 0

Modify button (FAB, bottom right):
- Opens ModifySheet (src/components/ModifySheet.tsx):
    "Swap exercise" → ExercisePicker, replaces current exercise, sets swappedFrom field
    "Skip exercise" → marks remaining sets as skipped, advances to next exercise
    "Add set" → appends one more set to current exercise
    "Reorder remaining" → drag list of remaining exercises

Finish button:
- If sets still remain: confirm dialog "End workout early?"
- Call endSession(sessionId)
- If modifiedFromTemplate: show "Save changes to template?" dialog
    Yes → upsertTemplate with current exercise state
    No → skip
- Navigate to /session/:id/summary

Hooks to create:
- src/hooks/useElapsedTimer.ts — setInterval incrementing seconds since startedAt
- src/hooks/useRestTimer.ts — countdown timer, returns { remaining, isRunning, start, skip }

Deliverable: full strength session — log sets, rest timer fires, modify mid-session, finish
and land on summary. Check sets are persisted in DB.
```

---

## Phase 7 — Cardio session screen

**Goal:** Active cardio logging with optional interval support.

### Claude instructions

```
Implement CardioSessionScreen at src/screens/CardioSessionScreen.tsx.

Layout:
1. SessionHeader: activity name, elapsed timer, Finish button
2. Large centred elapsed time (MM:SS format, 48px font)
3. If template has intervals:
   - Current interval name (e.g. "Work") in large text
   - Interval countdown (MM:SS)
   - Progress dots: one dot per interval, filled as completed
   - Auto-advance through intervals using useIntervalTimer hook
4. Below timer:
   - Distance input (optional, km or miles based on settings, numeric)
   - Pace display (auto-computed: duration / distance, shown as MM:SS /km)
   - Notes textarea
5. Finish button → save and navigate to summary

src/hooks/useIntervalTimer.ts:
- Takes IntervalBlock[] expanded into a flat sequence
- Tracks current interval index, time remaining in interval
- Returns: currentInterval, remaining, totalElapsed, isRunning, advance, reset
- Calls vibrate([200]) on each interval change

On finish: call addCardio() with all data, endSession(), navigate to /session/:id/summary

Deliverable: cardio session runs, intervals advance automatically, finish saves to DB.
```

---

## Phase 8 — Climbing session screen

**Goal:** Log routes with full tick type support, Ewbanks and V-grade.

### Claude instructions

```
Implement ClimbingSessionScreen at src/screens/ClimbingSessionScreen.tsx.

On mount:
- Load session by :id
- Call createClimbingSession({ sessionId: id }) to get climbingSessionId
- Store climbingSessionId in component state

Layout:
1. SessionHeader: "Climbing session", elapsed timer, Finish button
2. "Log a route" button (full width, prominent, at top of content area)
3. useLiveQuery on routes table filtered by climbingSessionId, ordered by loggedAt desc
4. RouteCard for each logged route:
   - Grade pill (V-grade or Ewbanks number)
   - Style badge (Bouldering / Top rope / Lead)
   - Tick badge (colour-coded: green for clean sends, amber for working, grey for attempts)
   - Route name or colour if set, attempts count if > 1
   - Tap → opens LogRouteSheet pre-populated for editing

LogRouteSheet (src/components/LogRouteSheet.tsx):
Three-step flow within a single bottom sheet (no page navigation):

Step 1 — Style:
  Segmented control: Bouldering | Top rope | Lead
  "Next" button

Step 2 — Grade:
  If bouldering: horizontal scrolling grade picker (VB, V0, V1 … V17)
    Wall angle picker below: Slab / Vertical / Overhang (icon buttons)
  If roped: numeric input for Ewbanks grade (show common range hint: "e.g. 14–35")
    Toggle: Top rope / Lead
  "Next" button, "Back" button

Step 3 — Tick & details:
  Tick type grid — show only valid ticks for chosen style (see docs/02_screens_and_routing.md)
    Each tick shown as a selectable pill with name and one-line description
  Optional fields (collapsible "Add details" section):
    Route name (text), Colour (text), Attempts (number), Notes (text)
  "Save" button, "Back" button

On Save: call addRoute() or updateRoute() depending on edit vs new, sheet closes.

Finish session: endSession(), navigate to /session/:id/summary

Deliverable: full climbing session — log 3+ routes of mixed styles, verify tick badges
display correctly, finish and check summary.
```

---

## Phase 9 — Session summary screen

**Goal:** Post-session recap for all three disciplines.

### Claude instructions

```
Implement SessionSummaryScreen at src/screens/SessionSummaryScreen.tsx.

Load session by :id. Branch on session.type.

Strength summary:
- Duration (endedAt - startedAt, formatted as "42 min")
- Total sets logged (count non-skipped sets)
- Total volume (sum of weightKg * actualReps across all sets, show in kg)
- Exercise breakdown: list each exercise with sets completed / total
- PRs section: query prs table for achievedAt within session window, show each as a
  PRBadge (gold highlight, trophy icon, "New PR: Squat 85kg × 5")
- If session.modifiedFromTemplate: show card "Save changes to template?" with Yes / No
  buttons (call upsertTemplate on Yes)

Cardio summary:
- Duration, distance, avg pace
- Interval splits: list each interval with its duration

Climbing summary:
- Total routes logged
- Hardest clean send (filter routes by tick in ['onsight','flash','send','clean',
  'redpoint','pink_point'], sort by grade, show top result)
- Tick breakdown: count by tick type, show as a small grid of pills with counts
- Duration

Shared footer:
- "Done" button → navigate to /home
- "View full details" link → /history/:id

PRBadge component (src/components/PRBadge.tsx):
- Animated entrance (scale from 0.8 to 1.0, 300ms ease-out)
- Gold/amber background, trophy icon, PR description text

Deliverable: complete a strength session with a new PR weight, verify PR appears on
summary screen. Complete a climbing session, verify tick breakdown is correct.
```

---

## Phase 10 — History & session detail

**Goal:** Browse and inspect past sessions.

### Claude instructions

```
Implement HistoryScreen and SessionDetailScreen.

HistoryScreen (src/screens/HistoryScreen.tsx):
- Filter pills: All / Strength / Cardio / Climbing
- useLiveQuery on sessions ordered by startedAt desc
- SessionCard for each (same component as HomeScreen)
- Group by month: show month/year headers between groups ("June 2025", "May 2025")
- EmptyState if no sessions

SessionDetailScreen (src/screens/SessionDetailScreen.tsx):
- Load session, then branch on type to load associated data

Strength detail:
- Header: name, date, duration, total volume
- Exercise sections: each exercise as an expandable accordion (shadcn Accordion)
  Inside: table of Set / Weight / Reps for each logged set, skipped sets shown greyed

Cardio detail:
- Header stats row: duration, distance, avg pace
- Interval splits as a table if present

Climbing detail:
- Session info: gym/crag if set, duration
- Route list: each route as a RouteCard (same as session screen, read-only)
- Grade distribution: simple inline bar showing count per grade band

Deliverable: past sessions browsable, detail screens show correct data for all types.
```

---

## Phase 11 — Progress screen

**Goal:** Charts for strength PRs, cardio trends, and climbing grade pyramid.

### Claude instructions

```
Install recharts. Implement ProgressScreen at src/screens/ProgressScreen.tsx.

Three tabs (shadcn Tabs component): Strength | Cardio | Climbing

Strength tab:
- Exercise picker dropdown (shadcn Select) populated from exercises table
- On selection: query sets table for that exerciseName, group by date, take best weight
  per session, render LineChart (recharts):
    x-axis: date, y-axis: weight (kg)
    Dots on each data point, responsive container
- Below chart: PR history list for selected exercise from prs table

Cardio tab:
- Activity picker: Run / Ride / Row / Other
- Toggle: Pace over time / Distance over time
- LineChart: x-axis date, y-axis pace (MM:SS /km formatted) or distance (km)

Climbing tab:
- Toggle: Bouldering / Roped
- Grade pyramid (horizontal bar chart):
    Bouldering: x-axis count, y-axis V-grade (VB at bottom, ascending)
    Roped: x-axis count, y-axis Ewbanks grade (ascending)
    Bar length = number of sends (clean ticks only) at that grade
    Bar colour encodes tick quality: gold for onsight/flash, green for send/redpoint,
    grey for working
- Below pyramid: hardest grade per month (small table)

Chart styling:
- Use CSS variable colours (--foreground, --muted-foreground) for axes/labels
- Responsive: charts fill container width, 200px height on mobile
- Empty state if no data for selected exercise/activity

Deliverable: log 3 strength sessions with increasing weights on the same exercise,
verify line chart shows upward trend. Verify climbing pyramid renders correctly.
```

---

## Phase 12 — Settings, export/import, polish

**Goal:** Data backup, unit toggle, and final iOS PWA polish.

### Claude instructions

```
Implement SettingsScreen and apply final iOS polish across the app.

SettingsScreen (src/screens/SettingsScreen.tsx):
- Units section:
    Toggle: kg / lbs (store in localStorage key 'units', default 'kg')
    When lbs selected, all weight display and input throughout app converts
    (create src/lib/units.ts with toDisplay(kg, units) and toKg(val, units) helpers)
- Data section:
    "Export data" button:
      call exportAllData(), create Blob with type 'application/json'
      trigger download via URL.createObjectURL + <a> click trick
      filename: `workout-tracker-backup-YYYY-MM-DD.json`
    "Import data" button:
      <input type="file" accept=".json"> (hidden, triggered by button click)
      on file selected: read as text, call importAllData(text)
      show success toast or error message
- About section: app version (from package.json via import.meta.env.VITE_APP_VERSION),
  link to GitHub repo

iOS PWA polish — apply these across the whole app:
1. Safe area insets: add pb-[env(safe-area-inset-bottom)] to BottomNav, pt-[env(safe-area-inset-top)] to SessionHeader
2. Prevent double-tap zoom: add touch-action: manipulation to all buttons and inputs
3. Prevent pull-to-refresh interfering with scroll: add overscroll-behavior-y: contain to main content containers
4. Viewport meta in index.html: viewport-fit=cover in the content attribute
5. Apple-specific PWA meta tags in index.html:
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
6. Numeric inputs on iOS: use inputMode="decimal" not type="number" to avoid the
   increment/decrement spinner
7. Keyboard avoiding: when an input is focused inside a bottom sheet, ensure the sheet
   scrolls so the input is visible (add paddingBottom equal to visualViewport height
   difference via a small useKeyboardHeight hook)

Final check — run through this list on actual iPhone Safari:
- Install as PWA (Add to Home Screen)
- Complete a full strength session end-to-end
- Complete a climbing session with 5 routes of mixed styles
- Export data, clear app data in Safari settings, re-import, verify data restored
- Rotate to landscape and back — layout should not break
- Test with no internet connection (airplane mode) — all features should work

Deliverable: fully polished, installable app. Tag as v1.0.0 and push to main.
```

---

## Phase summary

| Phase | Focus | Key deliverable |
|---|---|---|
| 1 | Scaffold + PWA | Installable blank shell |
| 2 | Database layer | Dexie schema + all helpers + seed data |
| 3 | Home screen | Real data, quick-start navigation |
| 4 | Library + template detail | Browse and launch workouts |
| 5 | Template editor | Full CRUD with drag reorder |
| 6 | Strength session | Set logging, rest timer, mid-session modify |
| 7 | Cardio session | Timer, intervals, pace |
| 8 | Climbing session | Route logging, tick types, grade pickers |
| 9 | Session summary | Post-workout recap, PR detection |
| 10 | History + detail | Browse and inspect past sessions |
| 11 | Progress screen | Charts and grade pyramid |
| 12 | Settings + polish | Export/import, iOS UX details |

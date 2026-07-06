\*\*F33. Move Height field below Angle in LogRouteSheet\*\* — reorder the fields in LogRouteSheet so that the Height input (A44) appears directly below the wall angle / character field (A45) for all climbing session types. No other field order changes.



\*\*F34. Remove hold colour from session log RouteCard\*\* — the hold colour label or swatch is already conveyed by the grade pill background (F26) and must not appear again as a separate field on the RouteCard in the active session screen or SessionDetailScreen. Remove the standalone colour indicator from the RouteCard layout entirely. The grade pill colouring from F26 is the sole colour indicator.



\*\*F35. Mixed and Wood swatch rendering on grade pill\*\* — when a route has Hold Colour set to Mixed or Wood and is displayed in the active session log, the grade pill falls back to the neutral style (F26) but the fallback is not rendering correctly. Fix the fallback so Mixed and Wood both display a consistent neutral pill (e.g. slate-600 background) with no broken or transparent swatch. Feature may use the same neutral fallback. Audit the colour resolution logic in the RouteCard component to ensure the fallback path is reached correctly when the hold colour value is `'mixed'`, `'wood'`, or `'feature'`.



\*\*F36. Unicode symbols for Boulder, Top rope, and Lead buttons\*\* — replace the text labels on the three climb-type buttons in ClimbingSessionScreen (A24) with Unicode symbols. Define these in `src/lib/tickTypes.ts` or a nearby constants file alongside the tick type symbols. Symbols:



\- Boulder — ⬟

\- Top rope — ⤒

\- Lead — ⚑



Render each symbol in a large size (minimum 24px) above or beside a small text sublabel so the buttons remain accessible. Use the same symbols wherever climb style is indicated throughout the app in place of text labels, including RouteCards in the active session log, SessionDetailScreen, and History.



\*\*F37. RouteCard layout reorder in active session log\*\* — restructure the RouteCard layout in ClimbingSessionScreen and SessionDetailScreen to the following order:



Row 1 (primary): grade pill with hold colour background (left-aligned) — climb type symbol (⬟ / ⤒ / ⚑) — tick type symbol and label — character label (Slab / Vertical / Overhang / Roof / Cave / Crack)



Row 2 (style tags): style tag pills wrapping as needed (Crimpy, Juggy, etc. from A47)



Row 3 (secondary details): attempts count — height — angle — "Felt like \[grade]" (only shown if a felt-like grade was recorded, A10)



No other fields appear on the RouteCard face. Route name and notes remain accessible via tap-to-edit (B3) but are not shown inline.



\*\*A52. Additional climb style tags\*\* — add Stretchy, Short, and Long to the fixed style descriptor list in LogRouteSheet (A47). Insert them at the end of the existing list: Crimpy, Juggy, Pumpy, Slopey, Pinchy, Dynamic, Static, Technical, Powerful, Endurance, Compression, Balancy, Mantle, Stemmy, Roofed, Fingery, Thuggish, Stretchy, Short, Long. Update the style breakdown in the Progress screen climbing tab to include these new tags.



\*\*A53. Default sub-max hang climbing workout\*\* — add a seeded hangboard template named "Sub-max Repeaters" to the climbing library. Structure it as a repeater protocol using science-based parameters (A3, A37): 6 exercises covering common grip positions (half crimp, open hand, three-finger drag, pinch, wide pinch, sloper), each configured as a sub-max hang (`hangType: 'sub\_max'`) with 7s work / 3s rest × 6 reps (Abrahang-style sequencing), edge depth 20mm, default additional weight 0kg, inter-set rest 180s, inter-exercise rest 300s. Include a comment in the seed file citing the repeater protocol source.



\*\*A54. Expand and remove seeded strength templates\*\* — remove the following seeded templates entirely: Full Body B, Legs B, Pull B, Push B. Expand the remaining four templates with additional exercises and set volume:



\- \*\*Push A\*\* — add: Cable fly 3×15 (60s rest), Dumbbell lateral raise 4×15 (60s rest), Arnold press 3×12 (90s rest), Tricep overhead extension 3×12 (90s rest)

\- \*\*Pull A\*\* — add: Single-arm dumbbell row 3×10 (90s rest), Cable rear delt fly 3×15 (60s rest), Hammer curl 3×12 (60s rest), Chin-up 3×6 (180s rest, `supportsAdditionalWeight: true`)

\- \*\*Legs A\*\* — add: Bulgarian split squat 3×10 (120s rest), Walking lunge 3×12 (90s rest), Calf raise 4×15 (60s rest), Glute bridge 3×15 (60s rest)

\- \*\*Full Body A\*\* — add: Deadlift 3×5 (300s rest), Dumbbell row 3×10 (90s rest), Push-up 3×15 (60s rest), Kettlebell swing 3×15 (90s rest)



Update rest times on existing exercises within these templates to match the science-based values from item 15 where they differ.



\*\*A55. Additional rehab exercises\*\* — add the following to the seeded exercise library with `category: 'rehab'`: Banded shoulder external rotation, Banded shoulder internal rotation, Wrist flexor stretch, Wrist extensor stretch, Wrist roller (flexion), Wrist roller (extension), Rice bucket (grip), Reverse wrist curl, Pronation and supination, Shoulder CARs, Hip 90/90 stretch, Dead hang (passive), Doorway chest stretch, Thoracic extension over foam roller, Scapular wall slide, Pallof press, Copenhagen plank, Single-leg Romanian deadlift (rehab weight), Tibialis raise, Calf eccentric (Alfredson protocol). Each exercise has appropriate `trackingType` (most are `duration` or `reps`), empty muscle groups where not applicable, and `supportsAdditionalWeight: false` unless otherwise conventional.



\*\*A56. Additional climbing-specific strength exercises\*\* — add the following to the seeded exercise library with `category: 'climbing'`, sourced from Lattice Training and climbing conditioning literature: Campus board move, System board move, Antagonist press (flat), Antagonist press (incline), Shoulder press (climbing antagonist), Wrist curl, Reverse wrist curl (climbing), Finger extension (rubber band), Rotator cuff external rotation, Scapular pull-up, Hollow body hold, Front lever progression, Back lever progression, L-sit, Plank with reach, Single-arm hang (assisted), Two-arm lock-off, One-arm lock-off, Typewriter pull-up, Archer pull-up. Set `trackingType` appropriately per exercise (`duration` for isometric holds, `reps` for dynamic movements) and `supportsAdditionalWeight: true` where external loading is conventional (campus moves, lock-offs, pull-up variations).



\*\*A57. Climbing strength and hangboard combined workout\*\* — add a seeded climbing workout template named "Strength and Fingers" that mixes climbing-specific strength exercises with hangboard sets in a single session. Structure: warm-up hang block (3 × sub-max open hand, 20mm, 10s, 120s rest), then strength block (Scapular pull-up 3×10, Two-arm lock-off 3×8s, Antagonist press 3×12, Hollow body hold 3×30s), then a second hang block (3 × half crimp max hang, 10mm, 7s, 300s rest), then antagonist finish (Reverse wrist curl 3×15, Finger extension 3×15). Rest times follow A3 and A37 science-based values. The session uses the combined ClimbingSessionScreen layout with exercises above the route log section.



\*\*A58. Cancel prompt when pressing back during new workout creation\*\* — when the user is in the process of creating a new workout template (TemplateEditScreen in new-template mode, not edit mode) and taps the back button or the Cancel button in the header, show a confirmation dialog: "Discard this workout? Your changes will not be saved." with "Discard" and "Keep editing" buttons. Confirming navigates back without saving. This applies to new template creation only — editing an existing template already has this behaviour from item 5.



\*\*A59. Log a workout from a single exercise\*\* — allow a session to be started directly from a single exercise without requiring a template. Add a "Start as workout" button to the exercise detail view or long-press context menu on any exercise card in the exercise library. Tapping it creates a new `WorkoutSession` with no `templateId`, sets `templateName` to the exercise name, and navigates to the appropriate active session screen with that single exercise pre-loaded using its default sets, reps/duration, and rest time. The session behaves identically to any other active session — additional exercises can be added mid-session (A29), the rest timer and pre-count fire normally, and the session completes to the summary screen as usual.



\*\*A60. Weight increment setting\*\* — add a "Weight increment" setting in the Settings screen under the Workout section. The setting is off by default. When enabled, a secondary input appears allowing the user to enter their preferred increment value. The input accepts any positive number up to two decimal places. A set of preset buttons is shown for quick selection: 0.25, 0.5, 1, 2, 5, 10, 15 — tapping a preset populates the input. The value is stored in `localStorage` under `'weightIncrement'` as a number, with a separate `'weightIncrementEnabled'` boolean key.



When enabled, the +/− buttons on all weight inputs in active session screens (standard weight, additional weight, hang weight) step by the configured increment instead of the default 0.5kg / 1lb. The increment is always applied in the user's current unit (kg or lbs from the units setting). Direct text entry in the weight field remains unrestricted — the increment only governs the +/− button step size. If the increment setting is disabled, the +/− buttons revert to the default step size.



\*\*F38. Template deletion must not cascade to session history\*\* — when `deleteTemplate(id)` is called, it must delete only the record from the `templates` table. It must not delete or modify any `WorkoutSession`, `LoggedSet`, `LoggedCardio`, `ClimbingSession`, or `ClimbingRoute` records that reference that `templateId`. Sessions referencing a deleted template will have a `templateId` that no longer resolves — this is expected and must be handled gracefully everywhere a template lookup is performed: if `getTemplate(templateId)` returns `undefined`, the session displays using the stored `templateName` snapshot rather than erroring or showing blank. The "Use as workout" and "Resume workout" buttons on SessionDetailScreen must check whether the source template still exists — if it has been deleted, "Use as workout" creates a new template from the session data rather than referencing the original, and "Resume workout" proceeds as normal since it operates on the session record directly.



\*\*A61. Save historic workout as a new template\*\* — add a "Save as template" button on SessionDetailScreen beneath the existing "Use as workout" button, visible for all completed strength, cardio, hangboard, and climbing workout sessions. Tapping it opens a small dialog with a pre-filled template name field (defaulting to the session's `templateName` snapshot) and a tag input. Confirming calls `upsertTemplate()` to create a brand new template record populated from the session data — exercises, sets, reps, rest times, and order derived from the logged sets for strength and hangboard sessions, or activity and interval structure for cardio sessions. The new template appears immediately in the Library. If a template with the same name already exists, append a number suffix (e.g. "Upper A 2") rather than overwriting. The original session record is not modified. For climbing route-logging sessions (Gym, Crag, Board) this button is not shown as those session types do not have a reusable template structure.



\*\*F39. Warning for empty weight fields\*\* — when the user taps "Log set" on a strength or hangboard set where the weight field is empty (no value entered and no pre-fill from a previous session), show an inline warning beneath the weight input rather than silently logging the set with a null weight. The warning reads "No weight entered — are you sure?" with two options presented as small buttons inline: "Log anyway" and "Add weight". Tapping "Log anyway" proceeds with `weightKg: undefined` as before. Tapping "Add weight" dismisses the warning and focuses the weight input. The warning must not block logging entirely — it is advisory only, since some exercises are legitimately performed without external load. The warning does not appear for exercises with `supportsAdditionalWeight: true` where the primary weight field is intentionally absent, nor for exercises with `trackingType: 'duration'` where weight is not a relevant field.



\*\*A62. Start new empty workout from HomeScreen\*\* — add a "New workout" button prominently on the HomeScreen, positioned above or alongside the quick-start discipline buttons. Tapping it immediately creates a new `WorkoutSession` with no `templateId`, `templateName` set to "New workout", `type: 'strength'`, and `startedAt: Date.now()`, then navigates to the StrengthSessionScreen for that session. The session opens with an empty exercise list and no pre-loaded exercises. A prominent "Add exercise" button (A29) is the primary call to action on the empty session screen, with a supporting label such as "Add your first exercise to get started." The user builds the workout entirely from scratch by adding exercises one at a time or via multi-select. All existing session features apply — rest timer, pre-count, pause/resume, cancel with confirmation, mid-session reorder and delete, and the full summary screen on completion.



\*\*F40. Consistent symbol style for Boulder, Top rope, and Lead\*\* — replace the Unicode symbols assigned to Boulder, Top rope, and Lead in F36 with Lucide React icons, matching the icon style used for Strength, Cardio, Gym, Crag, and other discipline buttons throughout the app. Choose icons that are visually intuitive for each climb style and render at the same size and weight as the other discipline icons. Update all locations where the F36 symbols appear — the climb-type buttons in ClimbingSessionScreen, RouteCards, SessionDetailScreen, and History — to use the Lucide icon components instead of the Unicode character spans.



\*\*A63. Character button icons\*\* — add a Lucide React icon to each climb character button in LogRouteSheet (A45). The icon appears above or beside the character label on each button. Choose icons that evoke the physical shape of each wall type:



\- Slab — a diagonal line leaning away (e.g. `TrendingDown` or `Minus` rotated)

\- Vertical — a straight vertical line (`Minus` rotated 90° or `ArrowUp`)

\- Overhang — a diagonal line leaning toward the climber (`TrendingUp`)

\- Roof — a horizontal ceiling line (`Minus` or `AlignCenter`)

\- Cave — an arched enclosing shape (`Archive` or `Inbox`)

\- Crack — a jagged vertical line (`Zap` or `SplitSquareVertical`)



Use the closest available Lucide icon for each. Render at the same size as other icon buttons in the sheet.



\*\*A64. Sport and Trad option for Crag lead and top rope\*\* — for Crag climbing sessions only, add a "Route type" toggle above the grade picker in LogRouteSheet when the style is Lead or Top rope. The two options are Sport and Trad. The selection is stored in a new optional field `routeType?: 'sport' | 'trad'` on `ClimbingRoute`. The toggle does not affect grade selection or tick type options — it is metadata only. For Bouldering in Crag sessions and for all Gym and Board session types, the toggle is not shown. Display the route type on RouteCards and in SessionDetailScreen as a small label alongside the style indicator.



\*\*A65. Collapsible "Felt like" section\*\* — wrap the felt-like grade picker (A10) in a collapsible disclosure element in LogRouteSheet for all climbing session types. The section is collapsed by default and toggled by tapping a row labelled "Felt like" with a chevron icon indicating open/closed state. When collapsed only the label row is visible. When expanded the grade picker appears below the label with no sheet layout shift if possible (the sheet should grow to accommodate rather than pushing other content off-screen). The felt-like value, if already set (e.g. when editing an existing route via B3), must cause the section to open automatically so the value is visible.



\*\*F41. Rehab exercises missing from exercise library\*\* — rehab exercises specified in A42 and A55 are not appearing in the app. Investigate and fix the full pipeline:



\- \*\*Seed check\*\* — inspect `src/db/seed.ts` and confirm all rehab exercises from A42 and A55 are present with `category: 'rehab'`. If any are missing, add them. The full expected list is: Theraband external rotation, Wrist roller, Rice bucket, Reverse wrist curl, Pronation and supination, Shoulder CARs, Hip 90/90 stretch, Dead hang (passive), Banded shoulder external rotation, Banded shoulder internal rotation, Wrist flexor stretch, Wrist extensor stretch, Wrist roller (flexion), Wrist roller (extension), Rice bucket (grip), Doorway chest stretch, Thoracic extension over foam roller, Scapular wall slide, Pallof press, Copenhagen plank, Single-leg Romanian deadlift (rehab weight), Tibialis raise, Calf eccentric (Alfredson protocol), Shoulder CARs, Hip 90/90 stretch, Dead hang (passive).

\- \*\*Seed execution\*\* — confirm `seedIfNeeded()` is actually inserting rehab exercises. If the `'db\_seeded'` flag in `localStorage` was set before rehab exercises were added to the seed file, the seed will not re-run. Add a seed version mechanism: store a `'db\_seed\_version'` key in `localStorage` alongside `'db\_seeded'`, and increment the seed version constant in `seed.ts` whenever new seed data is added. On load, if the stored version is lower than the current constant, run a partial re-seed that inserts only records whose `id` does not already exist in the DB, then update the stored version. This allows new seed content to be delivered to existing installs without wiping user data.

\- \*\*Library filter\*\* — confirm the LibraryScreen Rehab tab and the ExercisePicker sheet both filter correctly on `category: 'rehab'`. If the filter is applied to `type` instead of `category`, or if the field name differs between the type definition and the DB record, exercises will be silently excluded.

\- \*\*HomeScreen entry point\*\* — confirm the Rehab quick-start button (F31) navigates to `/library?type=rehab` and that the LibraryScreen correctly reads this query param to activate the Rehab tab on load.



\*\*A66. Universal exercise picker for new empty workouts\*\* — when starting a new empty workout from the HomeScreen (A62) or from a single exercise (A59), the ExercisePicker sheet must show all exercise categories rather than filtering to a single discipline. Display exercises grouped by category — Strength, Climbing, Rehab, Cardio — with a sticky category header for each group and a filter tab row at the top allowing the user to narrow to a single category if desired, with "All" as the default selected tab.



When a cardio exercise is added to a mixed session, the active session screen must render it using the cardio set row variant (duration and distance inputs rather than weight and reps). When a hangboard exercise is added, render it using the hangboard set row variant with the full countdown timer, pre-count, and Abrahang sequencing as applicable. When a rehab exercise is added, render it using whichever row variant matches its `trackingType` — duration-based rehab exercises use the countdown variant, reps-based rehab exercises use the standard reps row variant without a weight input unless `supportsAdditionalWeight` is true.



The session `type` for an empty workout created via A62 starts as `'strength'` but should be updated to `'mixed'` the first time a non-strength exercise is added. Add `'mixed'` as a new value to `DisciplineType`. The SessionSummaryScreen and SessionDetailScreen must handle `type: 'mixed'` by rendering each exercise block in the appropriate variant based on the exercise's own category and `trackingType`, rather than assuming a single display format for the whole session. History and the HomeScreen Recents list should display mixed sessions with a combined badge or the label "Mixed" and a suitable icon.

Here's that cleaned up:

---

**A67. Time between climbs in session log** — record a `loggedAt` timestamp on every `ClimbingRoute` (this field already exists per the data model). In the active ClimbingSessionScreen log list and in SessionDetailScreen, display the elapsed time between consecutive route entries on the far right of each RouteCard. Calculate it as the difference between the current route's `loggedAt` and the previous route's `loggedAt`, formatted as "4m 32s" or "1h 02m" for longer gaps. For the first route in a session, show the time since session start instead. The timestamp is display-only and requires no additional DB changes.

**A68. Rename historic workouts** — on SessionDetailScreen for any completed session, add a rename control to the session header — an edit icon beside the session name that switches it to an inline text input on tap. Saving updates the `templateName` field on the `WorkoutSession` record via a new DB helper `renameSession(id: string, name: string)`. Tapping away without changing the value cancels the edit. The renamed title must reflect immediately in History and Recents without a full reload.

**A69. Gym sections and areas** — in the Gyms settings section (A22), each saved gym can have one or more named sections or areas (e.g. "Cave", "Slab wall", "Competition wall"). Add an "Areas" subsection within the gym edit sheet where the user can add, rename, and delete area names for that gym. Areas are stored in `localStorage` under `'gym_areas'` as a map of gym name to string array. In the active Gym climbing session LogRouteSheet, add an optional "Area" field above the Hold Colour selector, rendered as a dropdown populated with the saved areas for the current gym, plus a "None" option and a freetext "Other" option. The selected area is stored in a new optional field `gymArea?: string` on `ClimbingRoute`. Display the area label on RouteCards in the session screen and SessionDetailScreen when set.

**A70. Filter by area in active gym climbing session** — in ClimbingSessionScreen for Gym sessions, add a filter control (a horizontally scrollable row of pill buttons) beneath the three climb-type buttons (A24). Pills are: "All" (default) plus one pill per area configured for the current gym (A69). Selecting an area pill filters the logged route list to show only routes tagged with that area. The filter is UI-state only — no DB changes. "All" always shows the full unfiltered list.

**A71. Attempts input with plus and minus buttons, default of 1** — replace the attempts text input in LogRouteSheet with a numeric stepper using − and + buttons flanking a numeric display, consistent with the A6 / A32 pattern. The default value is 1 for every tick type including those that previously had no default (all tick types now default to 1, not just Onsight and Flash). The field remains directly editable by tapping the number between the buttons. The minimum value is 1 — the − button is disabled at 1 and cannot go lower. Onsight and Flash no longer need a read-only override (A23) since the default of 1 and the minimum of 1 already enforce the correct behaviour — the field can remain editable for these tick types.

**A72. Additional climb styles and user-defined styles** — add the following to the fixed style descriptor list in LogRouteSheet (A47, A52): Scary, Ugly, Take 😩, Off belay. These appear in the same toggleable pill grid as the existing styles.

Add a "Climb styles" section in Settings where the user can define custom style tags. A text input and "Add" button allow new style names to be entered. Custom styles are stored in `localStorage` under `'custom_climb_styles'` as a JSON array of strings and are appended after the fixed styles in the pill grid in LogRouteSheet, separated by a subtle divider. Custom styles can be deleted from Settings with a confirmation prompt — deleting a style removes it from the available list but does not remove it from any `ClimbingRoute` records that already have it stored in `climbStyles`, so historical data is preserved. Take 😩 is stored as the string `'take'` internally with the display label "Take 😩".

**A73. Merge hangboarding into training sessions, remove climbing workouts** — restructure the discipline model to create a clean separation between climbing sessions and training sessions.



**Two top-level session categories:**



*Climbing sessions* — Gym, Crag, and Board. These are route-logging sessions only. No exercise sets, no hangboard blocks. The ClimbingSessionScreen for these types shows only the route log interface. No changes to their existing behaviour.



*Training sessions* — Strength, Cardio, Rehab, and the new Hangboard type, all of which can be freely mixed in a single session (A66). Hangboard exercises are now first-class exercises in the training exercise library, selectable from the ExercisePicker alongside strength, cardio, and rehab exercises. A training session containing hangboard exercises uses the same StrengthSessionScreen but renders hangboard exercise rows with the full countdown timer, pre-count, Abrahang sequencing, and science-based rest times as currently implemented in the climbing workout session screen.



**Changes required:**



- Remove the "Climbing workout" entry from the climbing library. Remove the "Hangboard" entry as a standalone climbing library option. Both are superseded by training sessions.

- Remove `DisciplineType` values `'climbing_workout'` and `'hangboard'` as top-level session types. Hangboard is now an exercise category, not a session type. A session containing hangboard exercises has `type: 'strength'` or `type: 'mixed'` (A66) depending on whether other exercise categories are also present.

- Migrate any existing `WorkoutSession` records with `type: 'climbing_workout'` or `type: 'hangboard'` to `type: 'mixed'` to preserve history. Existing `LoggedSet` records for hangboard exercises are unchanged — only the parent session type field changes.

- Move all seeded hangboard templates (Sub-max Repeaters, the max hang template from A37, and Strength and Fingers from A57) from the climbing library to the training library under a new "Hangboard" filter tab in the LibraryScreen alongside Strength, Cardio, and Rehab.

- Update the ExercisePicker category filter to include "Hangboard" as a selectable category tab (alongside Strength, Climbing, Rehab, Cardio) when opening from a training session context. Hangboard exercises remain `category: 'climbing'` in the DB — add a sub-category or tag filter on `hangType` being set to distinguish them from general climbing strength exercises, or introduce `category: 'hangboard'` as a fifth exercise category if that is cleaner. Use best judgement.

- Update the LibraryScreen Climbing section to show only Gym, Crag, and Board as fixed entries with no template list beneath them. The training section shows all strength, cardio, rehab, and hangboard templates as editable template cards.

- Update the HomeScreen quick-start section to reflect the new structure. Training quick-start buttons: Strength, Cardio, Rehab, Hangboard (each navigates to the library filtered by type, or starts an empty session). Climbing quick-start buttons: Gym, Crag, Board (each navigates to the name prompt as before).

- Update the Progress screen to reflect the restructure: hangboard progress lives under the Training tab or a dedicated Hangboard sub-tab, not under the Climbing tab. Climbing tab shows only route-based progress (grade pyramid, sends by style, sends by character, etc.).

- Update History filter tabs: Training (covers all non-climbing sessions including hangboard), Climbing (Gym, Crag, Board). Retain All as the default tab.

- Audit and update `DisciplineType`, `DisciplineBadge`, SessionCard, SessionSummaryScreen, and any other location that branches on discipline type to ensure all references to the removed types are cleaned up and no runtime errors occur.



Before starting A73, create a new git branch named `feature/training-restructure` from the current state of `main`. All changes for A73 must be committed to this branch. Do not merge to `main` until the full migration is verified working.



The migration must not affect existing user data. Implement it as a Dexie schema version upgrade following Dexie's standard versioning pattern — increment the DB version number and define an `upgrade()` function that runs the migration automatically on first open after the update. The upgrade function must:



- Read all `WorkoutSession` records where `type` is `'climbing_workout'` or `'hangboard'` and update them to `type: 'mixed'`.

- Leave all other session records, `LoggedSet`, `ClimbingRoute`, `ClimbingSession`, and all other table records completely untouched.

- Run exactly once — Dexie's version upgrade mechanism guarantees this.

- Handle errors gracefully — if the upgrade fails for any record, log the error and continue rather than aborting the entire upgrade, so a single bad record does not leave the DB in an inconsistent state.



After implementing the migration, verify it against the following cases before committing:

- A user with no existing data sees the new structure correctly with no errors.

- A user with existing `climbing_workout` sessions sees those sessions appear under Training in History with `type: 'mixed'` and all their `LoggedSet` records intact.

- A user with existing `hangboard` sessions sees the same.

- A user with existing Gym, Crag, and Board climbing sessions is completely unaffected — those sessions remain `type: 'climbing'` and appear in the Climbing section of History unchanged.



**A74. Exercise library filters and tags** — the exercise library view (accessible from the Library screen and ExercisePicker) must have the same filter tab row as the workout templates view: All, Strength, Cardio, Climbing, Rehab, and Hangboard. Add a tag filter row beneath the category tabs — a horizontally scrollable row of pill buttons showing all tags present on at least one exercise in the current category. Selecting a tag further narrows the list to exercises that have that tag. Selecting a second tag narrows further (AND logic, not OR). The active category tab and selected tags are independent filter dimensions applied simultaneously. The filter state is local UI state only and resets when the picker is dismissed. The exercise list within each category is sorted alphabetically by default.



**A75. Remove Gym, Crag, and Board fixed entries from the Climbing library section** — the Climbing section of the Library screen currently shows Gym, Crag, and Board as fixed non-template entries. Remove these entirely from the Library screen. Starting a Gym, Crag, or Board climbing session is now only accessible from the HomeScreen quick-start buttons (F32) and the Climbing quick-start button. The Library screen's Climbing tab (if it remains) shows only user-created climbing strength exercise templates. If there are no user-created climbing templates and the Climbing tab is otherwise empty, either hide the tab or show an appropriate empty state with a prompt to start a session from the Home screen instead.


# Reference

Quick lookup for constants and domain rules the app needs to encode correctly.

---

## Climbing grades

### V-grades (bouldering)

Order (easiest to hardest): VB, V0, V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, V15, V16, V17

Numeric sort index: VB = -1, V0 = 0, V1 = 1, … V17 = 17

### Ewbanks grades (roped — Australia/NZ)

Beginner range: 10–15
Recreational: 16–22
Intermediate: 23–27
Advanced: 28–32
Elite: 33+

Typical gym range to display in picker: 10–35 in steps of 1

---

## Tick types

### Valid ticks by style

```ts
export const TICK_TYPES = {
  bouldering: [
    { value: 'onsight',  label: 'Onsight',  desc: 'First try, no beta' },
    { value: 'flash',    label: 'Flash',    desc: 'First try, had beta' },
    { value: 'send',     label: 'Send',     desc: 'Clean, after attempts' },
    { value: 'working',  label: 'Working',  desc: 'Active project' },
    { value: 'repeat',   label: 'Repeat',   desc: 'Done it before' },
    { value: 'dab',      label: 'Dab',      desc: 'Touched ground / person' },
  ],
  top_rope: [
    { value: 'onsight',  label: 'Onsight',  desc: 'First try, no beta' },
    { value: 'flash',    label: 'Flash',    desc: 'First try, had beta' },
    { value: 'clean',    label: 'Clean',    desc: 'No falls, after attempts' },
    { value: 'hang_dog', label: 'Hang dog', desc: 'Fell or rested, topped' },
    { value: 'attempt',  label: 'Attempt',  desc: 'Did not top out' },
  ],
  lead: [
    { value: 'onsight',    label: 'Onsight',    desc: 'First try, no beta, led' },
    { value: 'flash',      label: 'Flash',      desc: 'First try, had beta, led' },
    { value: 'redpoint',   label: 'Redpoint',   desc: 'Clean lead, after attempts' },
    { value: 'pink_point', label: 'Pink point', desc: 'Redpoint, pre-clipped draws' },
    { value: 'hang_dog',   label: 'Hang dog',   desc: 'Fell or rested, topped' },
    { value: 'attempt',    label: 'Attempt',    desc: 'Did not top out' },
    { value: 'retreat',    label: 'Retreat',    desc: 'Bailed before top' },
  ],
}
```

### Clean ticks (for PR and pyramid calculations)

```ts
export const CLEAN_TICKS: ClimbingTick[] = [
  'onsight', 'flash', 'send', 'clean', 'redpoint', 'pink_point'
]
```

### Tick prestige order (highest first, for sorting)

Bouldering: onsight > flash > send > repeat > dab > working
Lead: onsight > flash > redpoint > pink_point > hang_dog > attempt > retreat
Top rope: onsight > flash > clean > hang_dog > attempt

---

## Colour coding for tick badges

| Tick | Background | Text |
|---|---|---|
| onsight | amber-400 | amber-900 |
| flash | amber-300 | amber-900 |
| send / clean / redpoint / pink_point | green-500 | green-950 |
| repeat | teal-400 | teal-900 |
| working | blue-400 | blue-900 |
| hang_dog / attempt / retreat / dab | slate-400 | slate-900 |

> Map each tick to a **complete, static** class string (e.g. `onsight: 'bg-amber-400 text-amber-900'`) in a lookup object. Never build class names dynamically (`bg-${x}-400`) — Tailwind's compiler can't see those and will purge them from the build.

---

## Duration formatting

```ts
// src/lib/formatDuration.ts
export function formatDuration(seconds: number): string {
  // < 60s → "45s"
  // < 3600s → "12:34"
  // >= 3600s → "1h 23m"
}

export function formatPace(secondsPerKm: number): string {
  // Returns "5:42 /km"
}

export function formatElapsed(seconds: number): string {
  // Always MM:SS — "07:42", "1:23:45"
}
```

---

## PR detection rules

A new PR is detected when:
- **Weight PR**: `actualReps >= targetReps && weightKg > previousBestWeightKg`
- **Reps PR**: `weightKg >= previousBestWeightKg && actualReps > previousBestReps`
- **Pace PR**: `avgPaceSecondsPerKm < previousBestPace` (lower is better)
- **Distance PR**: `distanceKm > previousBestDistance`
- **Grade PR (climbing)**: a clean tick (see `CLEAN_TICKS`) at a grade higher than any previous clean tick **for the same `climbingStyle`**

Grade PRs are stored keyed by `climbingStyle` (not exercise): `value` is the numeric grade — V-grade sort index (VB = -1 … V17 = 17) with `unit: 'vgrade'` for bouldering, or the Ewbanks number with `unit: 'ewbanks'` for top_rope/lead. Bouldering and roped PRs are therefore never compared against each other.

The caller (the session/summary flow) evaluates these conditions and calls `checkAndSavePR` with the resulting candidate; the helper only persists it if it still beats the stored best for that key. Only check PRs on logged sets / sessions immediately after saving, before navigating away.

---

## Units

Weights are stored and displayed in **kg only** in v1 — there is no unit conversion layer and no `lbs` toggle. (Distances are km, pace is seconds/km.) A kg↔lbs toggle is deferred to a later version; if added, weights stay stored in kg and only display/input convert.

---

## Persistent state

v1 stores no UI preferences in `localStorage`. All persistent data lives in IndexedDB (Dexie), and first-run seeding is detected via `await db.templates.count() === 0` — there is no `db_seeded` flag. Import restores data into the same tables, so it never triggers a re-seed.

---

## GitHub Pages SPA redirect

This is the rafgraph/spa-github-pages technique. Because the app is served from the project subpath `/workout_tracker/`, **`pathSegmentsToKeep = 1`** (keep the repo-name segment). If the app were ever moved to a root/custom domain, set it to `0`.

`public/404.html` must contain:

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Single Page Apps for GitHub Pages
    var pathSegmentsToKeep = 1; // /workout_tracker/ subpath
    var l = window.location;
    l.replace(
      l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
      l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
      l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
      (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
      l.hash
    );
  </script>
</head>
</html>
```

And `index.html` needs the matching restore script in `<head>`, **before** the app bundle loads:

```html
<script>
  (function(l) {
    if (l.search[1] === '/') {
      var decoded = l.search.slice(1).split('&').map(function(s) {
        return s.replace(/~and~/g, '&')
      }).join('?');
      window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
    }
  }(window.location))
</script>
```

React Router's `<BrowserRouter basename={import.meta.env.BASE_URL}>` (Phase 1) then resolves the restored path correctly.

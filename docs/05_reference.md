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
- **Grade PR (climbing)**: a clean tick at a grade higher than any previous clean tick for the same style

Only check PRs on logged sets / sessions immediately after saving, before navigating away.

---

## Unit conversion

```ts
// src/lib/units.ts
export type Units = 'kg' | 'lbs'

const KG_TO_LBS = 2.20462

export function toDisplay(kg: number, units: Units): number {
  return units === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg
}

export function toKg(val: number, units: Units): number {
  return units === 'lbs' ? Math.round((val / KG_TO_LBS) * 10) / 10 : val
}

export function unitLabel(units: Units): string {
  return units === 'lbs' ? 'lbs' : 'kg'
}
```

---

## Key localStorage keys

| Key | Value | Purpose |
|---|---|---|
| `db_seeded` | `'1'` | Prevents re-seeding on every load |
| `units` | `'kg'` \| `'lbs'` | Weight unit preference |

---

## GitHub Pages SPA redirect

`public/404.html` must contain this script to support client-side routing:

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    const l = window.location;
    l.replace(l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
      l.pathname.split('/').slice(0, 1).join('/') + '/?/' +
      l.pathname.slice(1) + (l.search ? '&' + l.search.slice(1) : '') + l.hash);
  </script>
</head>
</html>
```

And `index.html` needs a matching script in `<head>` to reconstruct the URL:

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

import type { TrackingType } from '@/types'

// Single source of truth for the exercise tracking types and their display
// labels (EX1). Previously the same reps/duration/distance list was repeated in
// the exercise form, the picker's create form, and the library row. Adding a
// tracking type now means adding one entry here (plus handling it in the input
// dispatch, resolveExerciseDefaults and estimateDuration — those stay in their
// own modules as they need per-type behaviour, not just a label).
export const TRACKING_TYPES: { value: TrackingType; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance', label: 'Distance' },
]

export const TRACKING_LABEL: Record<TrackingType, string> = Object.fromEntries(
  TRACKING_TYPES.map((t) => [t.value, t.label]),
) as Record<TrackingType, string>

import { WORKOUT_CATEGORY_OPTIONS, type WorkoutCategory } from '@/lib/templateCategories'
import { cn } from '@/lib/utils'

interface Props {
  value: WorkoutCategory[]
  onChange: (next: WorkoutCategory[]) => void
}

// A94 — the discipline picker for a workout template: toggle one or more of
// Strength / Cardio / Climbing / Hangboard / Rehab. Callers enforce "at least
// one selected". 'hangboard' is a UI-only build category (stored as 'climbing').
export function CategoryMultiSelect({ value, onChange }: Props) {
  function toggle(c: WorkoutCategory) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {WORKOUT_CATEGORY_OPTIONS.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={on}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors',
              on
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'bg-muted text-muted-foreground ring-border active:bg-accent',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

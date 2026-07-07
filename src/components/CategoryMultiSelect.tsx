import { TEMPLATE_CATEGORY_OPTIONS } from '@/lib/templateCategories'
import { cn } from '@/lib/utils'
import type { TemplateCategory } from '@/types'

interface Props {
  value: TemplateCategory[]
  onChange: (next: TemplateCategory[]) => void
}

// A94 — the discipline picker for a workout template: toggle one or more of
// Strength / Cardio / Climbing / Rehab. Callers enforce "at least one selected".
export function CategoryMultiSelect({ value, onChange }: Props) {
  function toggle(c: TemplateCategory) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {TEMPLATE_CATEGORY_OPTIONS.map((o) => {
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

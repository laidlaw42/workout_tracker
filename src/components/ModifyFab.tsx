import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onClick: () => void
  /** Lift above the rest-timer bar when it is showing (strength sessions). */
  raised?: boolean
  label?: string
}

// The in-session "Edit workout" button. Fixed to the same bottom-right spot on
// every session screen (strength, cardio, climbing) for consistency.
export function ModifyFab({ onClick, raised = false, label = 'Edit workout' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all',
        raised ? 'bottom-28' : 'bottom-6',
      )}
    >
      <SlidersHorizontal className="size-6" />
    </button>
  )
}

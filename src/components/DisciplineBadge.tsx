import { cn } from '@/lib/utils'
import type { DisciplineType } from '@/types'

// Static class strings (never build `bg-${x}` dynamically — Tailwind would purge it).
const STYLES: Record<DisciplineType, string> = {
  strength: 'bg-teal-500/15 text-teal-300 ring-teal-500/30',
  cardio: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  climbing: 'bg-green-500/15 text-green-300 ring-green-500/30',
}

const LABELS: Record<DisciplineType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  climbing: 'Climbing',
}

interface Props {
  type: DisciplineType
  className?: string
}

export function DisciplineBadge({ type, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STYLES[type],
        className,
      )}
    >
      {LABELS[type]}
    </span>
  )
}

import { cn } from '@/lib/utils'
import type { Badge } from '@/lib/badges'

interface Props {
  badge: Badge
  className?: string
}

export function DisciplineBadge({ badge, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badge.classes,
        className,
      )}
    >
      <span aria-hidden>{badge.emoji}</span>
      {badge.label}
    </span>
  )
}

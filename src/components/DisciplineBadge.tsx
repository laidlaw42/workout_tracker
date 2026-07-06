import { cn } from '@/lib/utils'
import type { Badge } from '@/lib/badges'

interface Props {
  badge: Badge
  className?: string
}

export function DisciplineBadge({ badge, className }: Props) {
  // Defensive: never crash the whole list if a badge fails to resolve (there is
  // no error boundary above this in the tree).
  if (!badge) return null
  const { Icon } = badge
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badge.classes,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {badge.label}
    </span>
  )
}

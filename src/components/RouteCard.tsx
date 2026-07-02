import { Pencil, Trash2 } from 'lucide-react'
import { STYLE_LABELS, tickBadgeClass, tickLabel } from '@/lib/climbing'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { ClimbingRoute } from '@/types'

interface Props {
  route: ClimbingRoute
  onClick?: () => void
  /** When provided, long-press opens an Edit / Delete context menu. */
  onDelete?: () => void
}

export function RouteCard({ route, onClick, onDelete }: Props) {
  const grade = route.vGrade ?? (route.ewbanksGrade != null ? String(route.ewbanksGrade) : '—')

  const card = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-accent"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted font-bold">
        {grade}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tickBadgeClass(route.tick))}
          >
            {tickLabel(route.tick)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {STYLE_LABELS[route.style]}
          </span>
        </div>
        {(route.routeName ||
          route.colour ||
          (route.attempts ?? 0) > 1 ||
          route.wallAngleDegrees != null) && (
          <p className="truncate text-xs text-muted-foreground">
            {[
              route.routeName,
              route.colour,
              route.wallAngleDegrees != null ? `${route.wallAngleDegrees}°` : null,
              (route.attempts ?? 0) > 1 ? `${route.attempts} attempts` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
    </button>
  )

  if (!onDelete) return card

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        {onClick && (
          <ContextMenuItem onSelect={onClick}>
            <Pencil /> Edit route
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete route
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

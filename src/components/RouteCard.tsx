import { Pencil, Trash2 } from 'lucide-react'
import { STYLE_LABELS, tickBadgeClass, tickLabel } from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import { findRouteColour } from '@/lib/routeColours'
import { useTickSymbol } from '@/hooks/useTickSymbol'
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
  const tickSymbol = useTickSymbol(route.tick)

  const grade =
    route.vGrade ??
    (route.ewbanksGrade != null
      ? String(route.ewbanksGrade)
      : route.gymGrade != null
        ? String(route.gymGrade)
        : '—')

  // Gym grades are never hue-mapped (F25). The grade pill instead takes the
  // selected hold colour (F26) when it has a representative hex — so it looks
  // like the tape on the wall — otherwise it renders neutral. Mixed/Wood/Feature
  // (no single hex) have no `solid`, so they too fall back to neutral.
  const gymHoldColour = route.gymGrade != null ? findRouteColour(route.colour)?.solid : undefined
  const gradeColor = route.vGrade
    ? vGradeToColor(route.vGrade)
    : route.ewbanksGrade != null
      ? gradeToColor(route.ewbanksGrade)
      : (gymHoldColour ?? null)

  const colour = findRouteColour(route.colour)

  // Attempts (F27): Onsight / Flash always read as a single attempt (A23); other
  // ticks show the entered value, and the label is omitted when unknown.
  const attemptCount = route.tick === 'onsight' || route.tick === 'flash' ? 1 : route.attempts

  const card = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-accent"
    >
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg font-bold',
          gradeColor ? '' : 'bg-muted',
        )}
        style={gradeColor ? { backgroundColor: gradeColor, color: contrastText(gradeColor) } : undefined}
      >
        {grade}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tickBadgeClass(route.tick))}
          >
            <span aria-hidden className="mr-0.5">
              {tickSymbol}
            </span>
            {tickLabel(route.tick)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {STYLE_LABELS[route.style]}
          </span>
          {route.colour &&
            (colour?.solid ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: colour.solid, color: contrastText(colour.solid) }}
              >
                {colour.label}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                {colour?.label ?? route.colour}
              </span>
            ))}
          {attemptCount != null && attemptCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {attemptCount} attempt{attemptCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {(route.routeName || route.wallAngleDegrees != null || route.feltLikeGrade) && (
          <p className="truncate text-xs text-muted-foreground">
            {[
              route.routeName,
              route.feltLikeGrade ? `felt ${route.feltLikeGrade}` : null,
              route.wallAngleDegrees != null ? `${route.wallAngleDegrees}°` : null,
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

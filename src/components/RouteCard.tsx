import { Pencil, Trash2 } from 'lucide-react'
import {
  CLIMB_CHARACTER_LABEL,
  CLIMB_STYLE_ICONS,
  CLIMB_STYLE_TEXT,
  STYLE_LABELS,
  climbStyleLabel,
  tickBadgeClass,
  tickLabel,
} from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import { formatGap } from '@/lib/formatDuration'
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
  /** Seconds since the previous route (or session start for the first) — A67. */
  gapSeconds?: number
}

export function RouteCard({ route, onClick, onDelete, gapSeconds }: Props) {
  const tickSymbol = useTickSymbol(route.tick)
  const StyleIcon = CLIMB_STYLE_ICONS[route.style] // F40 — Lucide climb-type icon

  const grade =
    route.vGrade ??
    (route.ewbanksGrade != null
      ? String(route.ewbanksGrade)
      : route.gymGrade != null
        ? String(route.gymGrade)
        : '—')

  // Gym grades are never hue-mapped (F25). The grade pill instead takes the
  // selected hold colour (F26) when it resolves to a single representative hex —
  // so it looks like the tape on the wall. Mixed / Wood / Feature have no `solid`
  // (F35), so findRouteColour(...)?.solid is undefined and gradeColor falls to
  // null, driving the neutral pill below. This is the sole colour indicator now:
  // the standalone colour swatch has been removed (F34).
  const gymHoldColour = route.gymGrade != null ? findRouteColour(route.colour)?.solid : undefined
  const gradeColor: string | null = route.vGrade
    ? vGradeToColor(route.vGrade)
    : route.ewbanksGrade != null
      ? gradeToColor(route.ewbanksGrade)
      : (gymHoldColour ?? null)

  // Attempts (F27, A71): show the stored count; legacy Onsight/Flash routes that
  // never stored one still read as a single attempt (A23).
  const attemptCount =
    route.attempts ?? (route.tick === 'onsight' || route.tick === 'flash' ? 1 : undefined)
  // Character (A45), falling back to a legacy wallAngle until it's migrated.
  const character = route.climbCharacter ?? route.wallAngle

  // Row 3 — secondary details (F37): attempts · height · angle · felt like.
  // "Felt like" only shows when a felt-like grade was recorded (A10).
  const secondary = [
    attemptCount != null && attemptCount > 0
      ? `${attemptCount} attempt${attemptCount === 1 ? '' : 's'}`
      : null,
    route.heightMetres != null ? `${route.heightMetres}m` : null,
    route.wallAngleDegrees != null ? `${route.wallAngleDegrees}°` : null,
    route.feltLikeGrade ? `Felt like ${route.feltLikeGrade}` : null,
  ].filter(Boolean)

  const card = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-accent"
    >
      {/* Grade pill — hold-colour background (F26) or neutral slate fallback for
          gym grades with no single hex (Mixed / Wood / Feature, F35). */}
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg font-bold',
          gradeColor ? '' : 'bg-slate-600 text-white',
        )}
        style={gradeColor ? { backgroundColor: gradeColor, color: contrastText(gradeColor) } : undefined}
      >
        {grade}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {/* Row 1 — climb-type icon · route type · route name · tick · character (F37/F40). */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StyleIcon
            role="img"
            aria-label={STYLE_LABELS[route.style]}
            className={`size-4 shrink-0 ${CLIMB_STYLE_TEXT[route.style]}`}
          />
          {route.routeType && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
              {route.routeType}
            </span>
          )}
          {route.routeName && (
            <span className="min-w-0 truncate text-sm font-medium">{route.routeName}</span>
          )}
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tickBadgeClass(route.tick))}
          >
            <span aria-hidden className="mr-0.5">
              {tickSymbol}
            </span>
            {tickLabel(route.tick)}
          </span>
          {character && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {CLIMB_CHARACTER_LABEL[character]}
            </span>
          )}
          {route.gymArea && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {route.gymArea}
            </span>
          )}
        </div>
        {/* Row 2 — style tags (A47). */}
        {route.climbStyles && route.climbStyles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {route.climbStyles.map((s) => (
              <span
                key={s}
                className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {climbStyleLabel(s)}
              </span>
            ))}
          </div>
        )}
        {/* Row 3 — secondary details (F37). */}
        {secondary.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{secondary.join(' · ')}</p>
        )}
      </div>
      {gapSeconds != null && (
        <span
          className="shrink-0 self-start pt-0.5 text-xs tabular-nums text-muted-foreground"
          title="Time since the previous climb"
        >
          {formatGap(gapSeconds)}
        </span>
      )}
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

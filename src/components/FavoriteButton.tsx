import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

// A heart toggle for favouriting a single exercise/workout. Stops propagation so
// it can sit inside a tappable card without triggering the card's own action.
export function FavoriteButton({
  favorite,
  onToggle,
  label,
  className,
}: {
  favorite: boolean
  onToggle: () => void
  /** Item name, for the accessible label. */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Unfavourite ${label}` : `Favourite ${label}`}
      aria-pressed={favorite}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent',
        className,
      )}
    >
      <Heart className={cn('size-5', favorite && 'fill-red-500 text-red-500')} />
    </button>
  )
}

// The "show favourites only" filter toggle that sits beside a category filter.
export function FavoriteFilterButton({
  active,
  onToggle,
  className,
}: {
  active: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Show favourites only"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-red-500/40 bg-red-500/10 text-red-500'
          : 'border-border text-muted-foreground active:bg-accent',
        className,
      )}
    >
      <Heart className={cn('size-5', active && 'fill-red-500')} />
    </button>
  )
}

import { cn } from '@/lib/utils'

// A togglable/selectable rounded pill. Shared by the LogRouteSheet Area selector
// (A69) and Style tags (A47/A72) and the ClimbingSessionScreen area filter (A70).
export function SelectPill({
  label,
  active,
  onClick,
  className,
}: {
  label: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground',
        className,
      )}
    >
      {label}
    </button>
  )
}

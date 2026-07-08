import { cn } from '@/lib/utils'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  id?: string
}

// A small on/off toggle. The off state carries a visible fill + inset ring so it
// reads clearly in light mode too (a bare `bg-muted` track vanished against a white
// card); the knob keeps a shadow + hairline ring for definition on either theme.
export function Switch({ checked, onChange, ariaLabel, id }: Props) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full ring-1 ring-inset transition-colors',
        checked ? 'bg-primary ring-transparent' : 'bg-foreground/25 ring-border',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm ring-1 ring-black/10 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

import { cn } from '@/lib/utils'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** Let the segments keep their natural width and scroll horizontally instead
   *  of squeezing to equal widths — for filters with many/long labels that would
   *  otherwise overflow (e.g. the six exercise categories). */
  scrollable?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  scrollable = false,
}: Props<T>) {
  return (
    <div
      className={cn(
        'flex w-full gap-1 rounded-lg bg-muted p-1',
        scrollable ? 'overflow-x-auto scrollbar-none' : 'inline-flex',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 rounded-md px-2 text-sm font-medium transition-colors',
            scrollable ? 'shrink-0 whitespace-nowrap px-3' : 'flex-1',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

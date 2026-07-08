import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
   *  otherwise overflow (e.g. the six exercise categories). Shows a chevron on
   *  each edge that has hidden segments (tap to scroll) and keeps the active
   *  segment in view. */
  scrollable?: boolean
  /** Per-segment colour classes (e.g. category accents). Return undefined for a
   *  segment to keep the default active/idle styling. */
  tone?: (value: T, active: boolean) => string | undefined
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  scrollable = false,
  tone,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Which edges have off-screen segments (drives the chevron hints).
  const [more, setMore] = useState({ left: false, right: false })

  useEffect(() => {
    if (!scrollable) return
    const el = scrollRef.current
    if (!el) return
    const update = () =>
      setMore({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [scrollable, options])

  // Keep the selected segment visible (e.g. a deep-linked category off to the right).
  useEffect(() => {
    if (!scrollable) return
    scrollRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [scrollable, value])

  const page = (dir: 1 | -1) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }

  const buttons = options.map((o) => {
    const active = value === o.value
    const toneClasses = tone?.(o.value, active)
    return (
      <button
        key={o.value}
        type="button"
        data-active={active}
        onClick={() => onChange(o.value)}
        className={cn(
          'min-h-9 rounded-md px-2 text-sm font-medium transition-colors',
          scrollable ? 'shrink-0 whitespace-nowrap px-3' : 'flex-1',
          toneClasses ??
            (active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'),
        )}
      >
        {o.label}
      </button>
    )
  })

  if (!scrollable) {
    return (
      <div className={cn('inline-flex w-full gap-1 rounded-lg bg-muted p-1', className)}>
        {buttons}
      </div>
    )
  }

  return (
    <div className={cn('relative w-full rounded-lg bg-muted', className)}>
      <div ref={scrollRef} className="flex gap-1 overflow-x-auto scrollbar-none p-1">
        {buttons}
      </div>
      {/* Edge chevrons: shown only when segments are hidden that way, so the
          control reads as scrollable. Tap to page; the gradient gives the icon a
          solid backdrop over the pills. */}
      {more.left && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => page(-1)}
          className="absolute inset-y-0 left-0 flex w-9 items-center justify-start rounded-l-lg bg-gradient-to-r from-muted via-muted to-transparent pl-1 text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {more.right && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => page(1)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-end rounded-r-lg bg-gradient-to-l from-muted via-muted to-transparent pr-1 text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}

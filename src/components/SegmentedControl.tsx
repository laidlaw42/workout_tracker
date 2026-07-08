import { useEffect, useRef, useState } from 'react'
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
   *  otherwise overflow (e.g. the six exercise categories). Fades the edge that
   *  has hidden segments so it reads as scrollable, and keeps the active segment
   *  in view. */
  scrollable?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  scrollable = false,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Which edges have off-screen segments (drives the fade hints).
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

  const buttons = options.map((o) => (
    <button
      key={o.value}
      type="button"
      data-active={value === o.value}
      onClick={() => onChange(o.value)}
      className={cn(
        'min-h-9 rounded-md px-2 text-sm font-medium transition-colors',
        scrollable ? 'shrink-0 whitespace-nowrap px-3' : 'flex-1',
        value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
      )}
    >
      {o.label}
    </button>
  ))

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
      {/* Edge fades: only shown when segments are hidden that way, so the control
          reads as scrollable. They fade into the track colour and let taps through. */}
      {more.left && (
        <div className="pointer-events-none absolute inset-y-1 left-0 w-7 rounded-l-lg bg-gradient-to-r from-muted to-transparent" />
      )}
      {more.right && (
        <div className="pointer-events-none absolute inset-y-1 right-0 w-7 rounded-r-lg bg-gradient-to-l from-muted to-transparent" />
      )}
    </div>
  )
}

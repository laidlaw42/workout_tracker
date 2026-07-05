import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onStep: () => void
  children: ReactNode
  'aria-label': string
  className?: string
  disabled?: boolean
}

// A press-and-hold stepper button (A6): fires once on press, then repeats while
// held, accelerating from 1/200ms to 1/80ms after 600ms. Shared by the wall-angle
// input, grade-range steppers, and the numeric set steppers (A32).
export function HoldButton({ onStep, children, 'aria-label': ariaLabel, className, disabled }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
  }
  const start = () => {
    if (disabled) return
    stop()
    onStep()
    const startedAt = Date.now()
    const tick = () => {
      onStep()
      timer.current = setTimeout(tick, Date.now() - startedAt > 600 ? 80 : 200)
    }
    timer.current = setTimeout(tick, 300)
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault()
        start()
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={cn(
        'flex size-9 shrink-0 select-none items-center justify-center rounded-lg border border-border text-foreground active:bg-accent disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

import { Minus, Plus } from 'lucide-react'
import { HoldButton } from '@/components/HoldButton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Increment per tap. 1 for reps/duration, 0.5 for kg (A32). */
  step?: number
  min?: number
  max?: number
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  ariaLabel: string
  className?: string
  inputClassName?: string
  /** Forwarded to the underlying input, e.g. to focus it (F39). */
  inputRef?: React.Ref<HTMLInputElement>
}

// A numeric field flanked by hold-to-repeat − / + steppers (A32). The field stays
// directly editable by tapping it. Values are held as strings so an empty field
// reads back as "unset" to the caller.
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  placeholder,
  inputMode = 'numeric',
  ariaLabel,
  className,
  inputClassName,
  inputRef,
}: Props) {
  const allowNegative = min == null || min < 0

  function nudge(delta: number) {
    const cur = value.trim() === '' ? 0 : Number(value)
    const base = Number.isFinite(cur) ? cur : 0
    let next = base + delta * step
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    // Round to 2dp so repeated 0.5 steps never accrue float noise.
    next = Math.round(next * 100) / 100
    onChange(String(next))
  }

  function onType(raw: string) {
    const digits = allowNegative ? '0-9.-' : '0-9.'
    let cleaned = raw.replace(new RegExp(`[^${digits}]`, 'g'), '')
    if (inputMode === 'numeric') cleaned = cleaned.replace(/\./g, '')
    // Keep a leading '-' only, and only when negatives are allowed.
    if (allowNegative) cleaned = cleaned.replace(/(?!^)-/g, '')
    onChange(cleaned)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <HoldButton aria-label={`Decrease ${ariaLabel}`} onStep={() => nudge(-1)}>
        <Minus className="size-4" />
      </HoldButton>
      <Input
        ref={inputRef}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onType(e.target.value)}
        className={cn('h-10 flex-1 text-center', inputClassName)}
      />
      <HoldButton aria-label={`Increase ${ariaLabel}`} onStep={() => nudge(1)}>
        <Plus className="size-4" />
      </HoldButton>
    </div>
  )
}
